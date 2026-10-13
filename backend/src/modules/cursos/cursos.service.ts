import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ArchivosService } from '../archivos/archivos.service.js';
import { CursosAccesoService } from './cursos-acceso.service.js';
import { CursosRepository } from './cursos.repository.js';
import type { ActualizarCursoDto, CrearCursoDto, QueryCursosDto } from './dto/curso.dto.js';
import { type AccionesCurso, CursoResponseDto } from './dto/curso-response.dto.js';
import { type Curso, ESTADOS_CURSO, type EstadoCurso } from './entities/curso.entity.js';

const CURSO_NO_ENCONTRADO = { message: 'El curso no existe.', code: 'CURSO_NO_ENCONTRADO' };
const CURSO_NO_EDITABLE = { message: 'No puedes editar este curso.', code: 'CURSO_NO_EDITABLE' };

const SOLO_BORRADOR = { message: 'Solo se elimina un curso en borrador; uno publicado se archiva.', code: 'CURSO_NO_ES_BORRADOR' };

const SOLO_DESDE: Record<EstadoCurso, string> = {
  BORRADOR: 'Solo se publica un curso en borrador.',
  PUBLICADO: 'Solo se archiva un curso publicado.',
  ARCHIVADO: 'Solo se reactiva un curso archivado.',
};

@Injectable()
export class CursosService {
  constructor(
    private readonly cursosRepository: CursosRepository,
    private readonly acceso: CursosAccesoService,
    private readonly archivosService: ArchivosService,
  ) {}

  async listar(filtros: QueryCursosDto, actor: UsuarioSesion): Promise<PaginatedResponseDto<CursoResponseDto>> {
    const { cursos, total } = await this.cursosRepository.listar(filtros, this.acceso.creadorVisible(actor));
    const data = cursos.map((detalle) => CursoResponseDto.desde(detalle, this.acciones(detalle.curso, actor)));
    return PaginatedResponseDto.crear(data, total, filtros);
  }

  // Un curso que no puede ver responde 404, como si no existiera (technical-spec 4.14)
  async obtener(id: string, actor: UsuarioSesion): Promise<CursoResponseDto> {
    const detalle = await this.cursosRepository.buscarDetalle(id);
    if (!detalle || !this.acceso.puedeVer(detalle.curso, actor)) throw new NotFoundException(CURSO_NO_ENCONTRADO);
    return CursoResponseDto.desde(detalle, this.acciones(detalle.curso, actor));
  }

  // RF-04.1: nace en borrador y con duracion 0; la duracion se recalcula al agregar videos (D-36)
  async crear(datos: CrearCursoDto, actor: UsuarioSesion): Promise<CursoResponseDto> {
    const curso = await this.cursosRepository.crear({
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      esObligatorio: datos.esObligatorio,
      fechaLimite: datos.fechaLimite ?? null,
      calificacionMinima: String(datos.calificacionMinima),
      creadoPor: actor.id,
    });
    return this.obtener(curso.id, actor);
  }

  // V-13: si alguien guardo despues de que se leyo el curso, no se sobrescribe nada (RN-04.11)
  async actualizar(id: string, datos: ActualizarCursoDto, actor: UsuarioSesion): Promise<CursoResponseDto> {
    await this.buscarEditable(id, actor);

    const actualizado = await this.cursosRepository.actualizarSiNoCambio(id, new Date(datos.actualizadoEn), {
      ...(datos.titulo !== undefined && { titulo: datos.titulo }),
      ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
      ...(datos.esObligatorio !== undefined && { esObligatorio: datos.esObligatorio }),
      ...(datos.fechaLimite !== undefined && { fechaLimite: datos.fechaLimite }),
      ...(datos.calificacionMinima !== undefined && { calificacionMinima: String(datos.calificacionMinima) }),
      actualizadoPor: actor.id,
    });
    if (!actualizado) {
      throw new ConflictException({
        message: 'Este curso cambió mientras lo editabas. Recarga para ver los cambios.',
        code: 'CURSO_MODIFICADO',
      });
    }
    return this.obtener(id, actor);
  }

  // La portada nueva se guarda antes de cambiar el curso; si eso falla, se borra para no dejar basura
  async cambiarPortada(id: string, archivo: Express.Multer.File | undefined, actor: UsuarioSesion): Promise<CursoResponseDto> {
    const curso = await this.buscarEditable(id, actor);
    const nueva = await this.archivosService.guardarPortada(archivo, actor.id);
    const anterior = curso.imagenArchivoId;

    curso.imagenArchivoId = nueva.id;
    curso.actualizadoPor = actor.id;
    try {
      await this.cursosRepository.guardar(curso);
    } catch (error) {
      await this.archivosService.eliminar(nueva.id);
      throw error;
    }
    if (anterior) await this.archivosService.eliminar(anterior);
    return this.obtener(id, actor);
  }

  // Sin portada, la interfaz muestra la generica (RF-04.2)
  async quitarPortada(id: string, actor: UsuarioSesion): Promise<CursoResponseDto> {
    const curso = await this.buscarEditable(id, actor);
    const anterior = curso.imagenArchivoId;
    if (anterior) {
      curso.imagenArchivoId = null;
      curso.actualizadoPor = actor.id;
      await this.cursosRepository.guardar(curso);
      await this.archivosService.eliminar(anterior);
    }
    return this.obtener(id, actor);
  }

  async publicar(id: string, actor: UsuarioSesion): Promise<CursoResponseDto> {
    const curso = await this.buscarVisible(id, actor);
    this.exigirPublicar(curso, actor);
    exigirEstado(curso, ESTADOS_CURSO.BORRADOR);
    await this.exigirContenido(id);
    await this.cambiarEstado(curso, ESTADOS_CURSO.BORRADOR, ESTADOS_CURSO.PUBLICADO, actor);
    return this.obtener(id, actor);
  }

  //deja de estar pendiente para todos; quien lo completo conserva su certificado
  async archivar(id: string, actor: UsuarioSesion): Promise<CursoResponseDto> {
    const curso = await this.buscarVisible(id, actor);
    if (!this.acceso.puedeArchivar(curso, actor)) throw new ForbiddenException(CURSO_NO_EDITABLE);
    exigirEstado(curso, ESTADOS_CURSO.PUBLICADO);
    await this.cambiarEstado(curso, ESTADOS_CURSO.PUBLICADO, ESTADOS_CURSO.ARCHIVADO, actor);
    return this.obtener(id, actor);
  }

  //se valida el contenido otra vez: pudieron ocultar temas mientras estaba archivado
  async reactivar(id: string, actor: UsuarioSesion): Promise<CursoResponseDto> {
    const curso = await this.buscarVisible(id, actor);
    this.exigirPublicar(curso, actor);
    exigirEstado(curso, ESTADOS_CURSO.ARCHIVADO);
    await this.exigirContenido(id);
    await this.cambiarEstado(curso, ESTADOS_CURSO.ARCHIVADO, ESTADOS_CURSO.PUBLICADO, actor);
    return this.obtener(id, actor);
  }

  //los archivos se borran despues: si borrar el curso falla, siguen ahi
  async eliminar(id: string, actor: UsuarioSesion): Promise<void> {
    const curso = await this.buscarEditable(id, actor);
    if (curso.estado !== ESTADOS_CURSO.BORRADOR) throw new ConflictException(SOLO_BORRADOR);
    const archivoIds = await this.cursosRepository.archivosDeMateriales(id);
    if (!(await this.cursosRepository.eliminarBorrador(id))) throw new ConflictException(SOLO_BORRADOR);
    if (curso.imagenArchivoId) archivoIds.push(curso.imagenArchivoId);
    for (const archivoId of archivoIds) await this.archivosService.eliminar(archivoId);
  }

  // Tambien la usan temas y materiales: el contenido se ve con el curso (V-12)
  async buscarVisible(id: string, actor: UsuarioSesion): Promise<Curso> {
    const curso = await this.cursosRepository.buscarPorId(id);
    if (!curso || !this.acceso.puedeVer(curso, actor)) throw new NotFoundException(CURSO_NO_ENCONTRADO);
    return curso;
  }

  // 404 si no lo puede ver; 403 si lo ve pero no lo puede editar (V-10)
  async buscarEditable(id: string, actor: UsuarioSesion): Promise<Curso> {
    const curso = await this.buscarVisible(id, actor);
    if (!this.acceso.puedeEditar(curso, actor)) throw new ForbiddenException(CURSO_NO_EDITABLE);
    return curso;
  }

  private acciones(curso: Curso, actor: UsuarioSesion): AccionesCurso {
    return {
      puedeEditar: this.acceso.puedeEditar(curso, actor),
      puedePublicar: this.acceso.puedePublicar(curso, actor),
      puedeArchivar: this.acceso.puedeArchivar(curso, actor),
    };
  }

  private exigirPublicar(curso: Curso, actor: UsuarioSesion): void {
    if (this.acceso.puedePublicar(curso, actor)) return;
    //el curso le toca, pero le falta un destino de sus sucursales
    if (this.acceso.puedeArchivar(curso, actor)) {
      throw new UnprocessableEntityException({
        message: 'Para publicar el curso, primero debe llegar a alguna de tus sucursales.',
        code: 'CURSO_SIN_DESTINO',
      });
    }
    throw new ForbiddenException(CURSO_NO_EDITABLE);
  }

  //la evaluacion final se exige cuando existan las evaluaciones
  private async exigirContenido(id: string): Promise<void> {
    if ((await this.cursosRepository.contarTemasVisibles(id)) === 0) {
      throw new UnprocessableEntityException({
        message: 'Agrega al menos un tema con un material antes de publicar el curso.',
        code: 'CURSO_INCOMPLETO',
      });
    }
    const vacios = await this.cursosRepository.temasVisiblesSinMateriales(id);
    if (vacios.length > 0) {
      throw new UnprocessableEntityException({
        message: `Cada tema visible necesita al menos un material visible. Revisa: ${vacios.map((t) => `"${t}"`).join(', ')}.`,
        code: 'CURSO_INCOMPLETO',
      });
    }
  }

  //el estado se revisa otra vez al guardar, por si alguien lo cambio mientras tanto
  private async cambiarEstado(curso: Curso, desde: EstadoCurso, hacia: EstadoCurso, actor: UsuarioSesion): Promise<void> {
    if (!(await this.cursosRepository.cambiarEstado(curso.id, desde, hacia, actor.id))) throw estadoInvalido(desde);
  }
}

function exigirEstado(curso: Curso, desde: EstadoCurso): void {
  if (curso.estado !== desde) throw estadoInvalido(desde);
}

function estadoInvalido(desde: EstadoCurso): ConflictException {
  return new ConflictException({ message: SOLO_DESDE[desde], code: 'CURSO_ESTADO_INVALIDO' });
}
