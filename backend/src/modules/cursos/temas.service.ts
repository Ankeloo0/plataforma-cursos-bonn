import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ArchivosService } from '../archivos/archivos.service.js';
import { CursosRepository } from './cursos.repository.js';
import { CursosService } from './cursos.service.js';
import type { ActualizarTemaDto, CrearTemaDto } from './dto/contenido.dto.js';
import { TemaResponseDto } from './dto/contenido-response.dto.js';
import type { Tema } from './entities/tema.entity.js';
import { MaterialesRepository } from './materiales.repository.js';
import { TemasRepository } from './temas.repository.js';

export const CONTENIDO_MODIFICADO = {
  message: 'Este curso cambió mientras lo editabas. Recarga para ver los cambios.',
  code: 'CURSO_MODIFICADO',
};

// Temas de un curso (RF-04.3). Quien ve el curso ve su contenido; quien lo edita, lo cambia (V-10, V-12).
// Cada cambio recalcula la duracion del curso y lo marca como modificado, en la misma transaccion.
@Injectable()
export class TemasService {
  constructor(
    private readonly temasRepository: TemasRepository,
    private readonly materialesRepository: MaterialesRepository,
    private readonly cursosService: CursosService,
    private readonly cursosRepository: CursosRepository,
    private readonly archivosService: ArchivosService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Temas en orden con sus materiales, incluidos los ocultos, para el editor
  async listar(cursoId: string, actor: UsuarioSesion): Promise<TemaResponseDto[]> {
    await this.cursosService.buscarVisible(cursoId, actor);
    const temas = await this.temasRepository.listarPorCurso(cursoId);
    const materiales = await this.materialesRepository.listarPorTemas(temas.map((t) => t.id));
    return temas.map((tema) =>
      TemaResponseDto.desde(
        tema,
        materiales.filter((m) => m.temaId === tema.id),
      ),
    );
  }

  async crear(cursoId: string, datos: CrearTemaDto, actor: UsuarioSesion): Promise<TemaResponseDto> {
    await this.cursosService.buscarEditable(cursoId, actor);
    const tema = await this.dataSource.transaction(async (manager) => {
      const nuevo = await this.temasRepository.crear(
        { cursoId, titulo: datos.titulo, descripcion: datos.descripcion ?? null, creadoPor: actor.id },
        manager,
      );
      await this.cursosRepository.recalcularDuracion(cursoId, actor.id, manager);
      return nuevo;
    });
    return this.obtener(tema.id);
  }

  // V-13: si alguien guardo el tema despues de que se leyo, no se sobrescribe nada
  async actualizar(id: string, datos: ActualizarTemaDto, actor: UsuarioSesion): Promise<TemaResponseDto> {
    const tema = await this.buscarEditable(id, actor);
    await this.dataSource.transaction(async (manager) => {
      const actualizado = await this.temasRepository.actualizarSiNoCambio(
        id,
        new Date(datos.actualizadoEn),
        {
          ...(datos.titulo !== undefined && { titulo: datos.titulo }),
          ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
          actualizadoPor: actor.id,
        },
        manager,
      );
      if (!actualizado) throw new ConflictException(CONTENIDO_MODIFICADO);
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
    });
    return this.obtener(id);
  }

  // Ocultar en lugar de borrar cuando ya tiene avance (RN-04.5, D-32). Deja de sumar a la duracion.
  async cambiarVisibilidad(id: string, activo: boolean, actor: UsuarioSesion): Promise<TemaResponseDto> {
    const tema = await this.buscarEditable(id, actor);
    await this.dataSource.transaction(async (manager) => {
      await this.temasRepository.cambiarActivo(id, activo, actor.id, manager);
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
    });
    return this.obtener(id);
  }

  // V-15 (no borrar con avance) llega en I5 con progreso_materiales e intentos.
  // Los archivos de sus materiales se borran despues del commit: si la transaccion falla, siguen ahi.
  async eliminar(id: string, actor: UsuarioSesion): Promise<void> {
    const tema = await this.buscarEditable(id, actor);
    const archivoIds = await this.materialesRepository.archivosDeTema(id);
    await this.dataSource.transaction(async (manager) => {
      await this.temasRepository.eliminar(id, manager);
      await this.cursosRepository.recalcularDuracion(tema.cursoId, actor.id, manager);
    });
    for (const archivoId of archivoIds) await this.archivosService.eliminar(archivoId);
  }

  // La lista debe traer exactamente los temas del curso; si no, alguien agrego o borro uno mientras tanto
  async reordenar(cursoId: string, ids: string[], actor: UsuarioSesion): Promise<void> {
    await this.cursosService.buscarEditable(cursoId, actor);
    const actuales = await this.temasRepository.listarPorCurso(cursoId);
    if (!mismosElementos(actuales.map((t) => t.id), ids)) throw new ConflictException(CONTENIDO_MODIFICADO);
    await this.dataSource.transaction(async (manager) => {
      await this.temasRepository.reordenar(cursoId, ids, manager);
      await this.cursosRepository.recalcularDuracion(cursoId, actor.id, manager);
    });
  }

  // Tambien la usa MaterialesService: un tema se edita si su curso se puede editar
  async buscarEditable(id: string, actor: UsuarioSesion): Promise<Tema> {
    const tema = await this.temasRepository.buscarPorId(id);
    if (!tema) throw new NotFoundException({ message: 'El tema no existe.', code: 'TEMA_NO_ENCONTRADO' });
    await this.cursosService.buscarEditable(tema.cursoId, actor);
    return tema;
  }

  private async obtener(id: string): Promise<TemaResponseDto> {
    const tema = await this.temasRepository.buscarPorId(id);
    const materiales = await this.materialesRepository.listarPorTemas([id]);
    return TemaResponseDto.desde(tema!, materiales);
  }
}

export function mismosElementos(actuales: string[], enviados: string[]): boolean {
  return actuales.length === enviados.length && actuales.every((id) => enviados.includes(id));
}
