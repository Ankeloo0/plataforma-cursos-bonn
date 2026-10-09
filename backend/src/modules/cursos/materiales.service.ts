import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ArchivosService } from '../archivos/archivos.service.js';
import { MediosService } from '../archivos/medios.service.js';
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

// Materiales de un tema (RF-04.4). El archivo ya se subio con POST /archivos (technical-spec 4.8).
@Injectable()
export class MaterialesService {
  constructor(
    private readonly materialesRepository: MaterialesRepository,
    private readonly temasService: TemasService,
    private readonly cursosRepository: CursosRepository,
    private readonly archivosService: ArchivosService,
    private readonly mediosService: MediosService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async crear(temaId: string, datos: CrearMaterialDto, actor: UsuarioSesion): Promise<MaterialResponseDto> {
    const tema = await this.temasService.buscarEditable(temaId, actor);
    const fuente =
      datos.tipo === TIPOS_MATERIAL.ENLACE
        ? { archivoId: null, urlExterna: datos.urlExterna!, duracionSegundos: 0, textoExtraido: null }
        : { ...(await this.leerArchivo(datos.archivoId!, datos.tipo, actor)), urlExterna: null };

    const material = await this.dataSource.transaction(async (manager) => {
      const nuevo = await this.materialesRepository.crear(
        { temaId, tipo: datos.tipo, titulo: datos.titulo, descripcion: datos.descripcion ?? null, ...fuente, creadoPor: actor.id },
        manager,
      );
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
      return nuevo;
    });
    return this.obtener(material.id);
  }

  // V-13. Un archivo nuevo reemplaza al anterior, que se borra despues del commit.
  async actualizar(id: string, datos: ActualizarMaterialDto, actor: UsuarioSesion): Promise<MaterialResponseDto> {
    const { material, tema } = await this.buscarEditable(id, actor);
    const esEnlace = material.tipo === TIPOS_MATERIAL.ENLACE;
    if ((esEnlace && datos.archivoId) || (!esEnlace && datos.urlExterna)) {
      throw new UnprocessableEntityException({
        message: esEnlace ? 'Un enlace no lleva archivo.' : 'Este material lleva un archivo, no un enlace.',
        code: 'MATERIAL_FUENTE_INVALIDA',
      });
    }
    const reemplazo =
      datos.archivoId && datos.archivoId !== material.archivoId
        ? await this.leerArchivo(datos.archivoId, material.tipo, actor)
        : undefined;

    await this.dataSource.transaction(async (manager) => {
      const actualizado = await this.materialesRepository.actualizarSiNoCambio(
        id,
        new Date(datos.actualizadoEn),
        {
          ...(datos.titulo !== undefined && { titulo: datos.titulo }),
          ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
          ...(datos.urlExterna !== undefined && { urlExterna: datos.urlExterna }),
          ...reemplazo,
          actualizadoPor: actor.id,
        },
        manager,
      );
      if (!actualizado) throw new ConflictException(CONTENIDO_MODIFICADO);
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
    });
    if (reemplazo && material.archivoId) await this.archivosService.eliminar(material.archivoId);
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
