import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ArchivosService } from '../archivos/archivos.service.js';
import { CursosAccesoService } from './cursos-acceso.service.js';
import { CursosRepository } from './cursos.repository.js';
import type { ActualizarCursoDto, CrearCursoDto, QueryCursosDto } from './dto/curso.dto.js';
import { CursoResponseDto } from './dto/curso-response.dto.js';
import type { Curso } from './entities/curso.entity.js';

const CURSO_NO_ENCONTRADO = { message: 'El curso no existe.', code: 'CURSO_NO_ENCONTRADO' };

@Injectable()
export class CursosService {
  constructor(
    private readonly cursosRepository: CursosRepository,
    private readonly acceso: CursosAccesoService,
    private readonly archivosService: ArchivosService,
  ) {}

  async listar(filtros: QueryCursosDto, actor: UsuarioSesion): Promise<PaginatedResponseDto<CursoResponseDto>> {
    const { cursos, total } = await this.cursosRepository.listar(filtros, this.acceso.creadorVisible(actor));
    const data = cursos.map((detalle) => CursoResponseDto.desde(detalle, this.acceso.puedeEditar(detalle.curso, actor)));
    return PaginatedResponseDto.crear(data, total, filtros);
  }

  // Un curso que no puede ver responde 404, como si no existiera (technical-spec 4.14)
  async obtener(id: string, actor: UsuarioSesion): Promise<CursoResponseDto> {
    const detalle = await this.cursosRepository.buscarDetalle(id);
    if (!detalle || !this.acceso.puedeVer(detalle.curso, actor)) throw new NotFoundException(CURSO_NO_ENCONTRADO);
    return CursoResponseDto.desde(detalle, this.acceso.puedeEditar(detalle.curso, actor));
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

  // Tambien la usan temas y materiales: el contenido se ve con el curso (V-12)
  async buscarVisible(id: string, actor: UsuarioSesion): Promise<Curso> {
    const curso = await this.cursosRepository.buscarPorId(id);
    if (!curso || !this.acceso.puedeVer(curso, actor)) throw new NotFoundException(CURSO_NO_ENCONTRADO);
    return curso;
  }

  // 404 si no lo puede ver; 403 si lo ve pero no lo puede editar (V-10)
  async buscarEditable(id: string, actor: UsuarioSesion): Promise<Curso> {
    const curso = await this.buscarVisible(id, actor);
    if (!this.acceso.puedeEditar(curso, actor)) {
      throw new ForbiddenException({ message: 'No puedes editar este curso.', code: 'CURSO_NO_EDITABLE' });
    }
    return curso;
  }
}
