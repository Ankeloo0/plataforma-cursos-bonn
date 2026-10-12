import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ArchivosService } from '../archivos/archivos.service.js';
import { CompresionVideoService } from '../archivos/compresion-video.service.js';
import { MediosService } from '../archivos/medios.service.js';
import { duracionDelArticuloSegundos, limpiarArticulo, palabrasDelArticulo } from './articulo.js';
import { CursosRepository } from './cursos.repository.js';
import type { ActualizarMaterialDto, CrearMaterialDto } from './dto/contenido.dto.js';
import { MaterialResponseDto } from './dto/contenido-response.dto.js';
import { type Material, TIPOS_MATERIAL, type TipoMaterial } from './entities/material.entity.js';
import { MaterialesRepository } from './materiales.repository.js';
import { CONTENIDO_MODIFICADO, mismosElementos, TemasService } from './temas.service.js';
import type { Tema } from './entities/tema.entity.js';

// Lo que se guarda de un archivo segun el tipo del material: duracion del video y texto del PDF
interface DatosDeArchivo {
  archivoId: string;
  duracionSegundos: number;
  textoExtraido: string | null;
}

// Una sola fuente por material (ck_materiales_fuente); las otras dos quedan en null
type DatosDeFuente = Pick<Material, 'archivoId' | 'urlExterna' | 'contenido' | 'duracionSegundos' | 'textoExtraido'>;

// Materiales de un tema (RF-04.4). El archivo ya se subio con POST /archivos (technical-spec 4.8).
// Un video se comprime despues de guardarlo, para no gastar CPU en subidas que se cancelan (RF-04.6).
@Injectable()
export class MaterialesService {
  constructor(
    private readonly materialesRepository: MaterialesRepository,
    private readonly temasService: TemasService,
    private readonly cursosRepository: CursosRepository,
    private readonly archivosService: ArchivosService,
    private readonly mediosService: MediosService,
    private readonly compresionVideo: CompresionVideoService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async crear(temaId: string, datos: CrearMaterialDto, actor: UsuarioSesion): Promise<MaterialResponseDto> {
    const tema = await this.temasService.buscarEditable(temaId, actor);
    const sinFuente = { archivoId: null, urlExterna: null, contenido: null, duracionSegundos: 0, textoExtraido: null };
    let fuente: DatosDeFuente;
    if (datos.tipo === TIPOS_MATERIAL.ENLACE) {
      fuente = { ...sinFuente, urlExterna: datos.urlExterna! };
    } else if (datos.tipo === TIPOS_MATERIAL.ARTICULO) {
      fuente = { ...sinFuente, ...this.leerArticulo(datos.contenido!) };
    } else {
      fuente = { ...sinFuente, ...(await this.leerArchivo(datos.archivoId!, datos.tipo, actor)) };
    }

    const material = await this.dataSource.transaction(async (manager) => {
      const nuevo = await this.materialesRepository.crear(
        { temaId, tipo: datos.tipo, titulo: datos.titulo, descripcion: datos.descripcion ?? null, ...fuente, creadoPor: actor.id },
        manager,
      );
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
      return nuevo;
    });
    if (datos.tipo === TIPOS_MATERIAL.VIDEO) await this.compresionVideo.encolar(fuente.archivoId!);
    return this.obtener(material.id);
  }

  // V-13. Un archivo nuevo reemplaza al anterior, que se borra despues del commit.
  async actualizar(id: string, datos: ActualizarMaterialDto, actor: UsuarioSesion): Promise<MaterialResponseDto> {
    const { material, tema } = await this.buscarEditable(id, actor);
    this.exigirFuenteDelTipo(material.tipo, datos);
    const reemplazo =
      datos.archivoId && datos.archivoId !== material.archivoId
        ? await this.leerArchivo(datos.archivoId, material.tipo, actor)
        : undefined;
    const articulo = datos.contenido !== undefined ? this.leerArticulo(datos.contenido) : undefined;

    await this.dataSource.transaction(async (manager) => {
      const actualizado = await this.materialesRepository.actualizarSiNoCambio(
        id,
        new Date(datos.actualizadoEn),
        {
          ...(datos.titulo !== undefined && { titulo: datos.titulo }),
          ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
          ...(datos.urlExterna !== undefined && { urlExterna: datos.urlExterna }),
          ...reemplazo,
          ...articulo,
          actualizadoPor: actor.id,
        },
        manager,
      );
      if (!actualizado) throw new ConflictException(CONTENIDO_MODIFICADO);
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
    });
    if (reemplazo && material.archivoId) await this.archivosService.eliminar(material.archivoId);
    if (reemplazo && material.tipo === TIPOS_MATERIAL.VIDEO) await this.compresionVideo.encolar(reemplazo.archivoId);
    return this.obtener(id);
  }

  // Ocultar en lugar de borrar cuando ya tiene avance (RN-04.5, D-32). Deja de sumar a la duracion.
  async cambiarVisibilidad(id: string, activo: boolean, actor: UsuarioSesion): Promise<MaterialResponseDto> {
    const { tema } = await this.buscarEditable(id, actor);
    await this.dataSource.transaction(async (manager) => {
      await this.materialesRepository.cambiarActivo(id, activo, actor.id, manager);
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
    });
    return this.obtener(id);
  }

  // V-15 (no borrar con avance) llega en I5. El archivo se borra despues del commit.
  async eliminar(id: string, actor: UsuarioSesion): Promise<void> {
    const { material, tema } = await this.buscarEditable(id, actor);
    await this.dataSource.transaction(async (manager) => {
      await this.materialesRepository.eliminar(id, manager);
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
    });
    if (material.archivoId) await this.archivosService.eliminar(material.archivoId);
  }

  // Solo dentro del mismo tema: la lista debe traer exactamente sus materiales
  async reordenar(temaId: string, ids: string[], actor: UsuarioSesion): Promise<void> {
    const tema = await this.temasService.buscarEditable(temaId, actor);
    const actuales = await this.materialesRepository.listarPorTemas([temaId]);
    if (!mismosElementos(actuales.map((m) => m.id), ids)) throw new ConflictException(CONTENIDO_MODIFICADO);
    await this.dataSource.transaction(async (manager) => {
      await this.materialesRepository.reordenar(temaId, ids, manager);
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
    });
  }

  // El tipo real del archivo debe ser el del material. ffprobe y unpdf corren antes de la transaccion,
  // porque leen el archivo del disco y no deben tener abierta una conexion a la base mientras tanto.
  private async leerArchivo(archivoId: string, tipo: TipoMaterial, actor: UsuarioSesion): Promise<DatosDeArchivo> {
    const { archivo, tipo: tipoDelArchivo } = await this.archivosService.exigirParaMaterial(archivoId, actor.id);
    if (tipoDelArchivo !== tipo) {
      throw new UnprocessableEntityException({
        message: 'El archivo no corresponde al tipo de material. Elige otro archivo o cambia el tipo.',
        code: 'ARCHIVO_TIPO_NO_COINCIDE',
      });
    }
    return {
      archivoId: archivo.id,
      duracionSegundos: tipo === TIPOS_MATERIAL.VIDEO ? await this.mediosService.duracionVideoSegundos(archivo.storageKey) : 0,
      textoExtraido: tipo === TIPOS_MATERIAL.PDF ? await this.mediosService.textoPdf(archivo.storageKey) : null,
    };
  }

  // D-37: se guarda el HTML limpio y la duracion sale de sus palabras. Sin texto no hay articulo.
  private leerArticulo(html: string): { contenido: string; duracionSegundos: number } {
    const contenido = limpiarArticulo(html);
    const palabras = palabrasDelArticulo(contenido);
    if (palabras === 0) {
      throw new UnprocessableEntityException({ message: 'Escribe el contenido del artículo.', code: 'ARTICULO_VACIO' });
    }
    return { contenido, duracionSegundos: duracionDelArticuloSegundos(palabras) };
  }

  // Al editar, cada tipo solo acepta su propia fuente: archivo, enlace o texto del articulo
  private exigirFuenteDelTipo(tipo: TipoMaterial, datos: ActualizarMaterialDto): void {
    let mensaje: string | null = null;
    if (tipo === TIPOS_MATERIAL.ENLACE && (datos.archivoId || datos.contenido !== undefined)) {
      mensaje = 'Un enlace solo lleva su dirección.';
    } else if (tipo === TIPOS_MATERIAL.ARTICULO && (datos.archivoId || datos.urlExterna)) {
      mensaje = 'Un artículo solo lleva su texto.';
    } else if (tipo !== TIPOS_MATERIAL.ENLACE && tipo !== TIPOS_MATERIAL.ARTICULO && (datos.urlExterna || datos.contenido !== undefined)) {
      mensaje = 'Este material lleva un archivo.';
    }
    if (mensaje) throw new UnprocessableEntityException({ message: mensaje, code: 'MATERIAL_FUENTE_INVALIDA' });
  }

  private async buscarEditable(id: string, actor: UsuarioSesion): Promise<{ material: Material; tema: Tema }> {
    const material = await this.materialesRepository.buscarPorId(id);
    if (!material) throw new NotFoundException({ message: 'El material no existe.', code: 'MATERIAL_NO_ENCONTRADO' });
    const tema = await this.temasService.buscarEditable(material.temaId, actor);
    return { material, tema };
  }

  private async obtener(id: string): Promise<MaterialResponseDto> {
    return MaterialResponseDto.desde((await this.materialesRepository.buscarPorId(id))!);
  }
}
