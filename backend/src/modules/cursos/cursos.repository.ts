import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { patronBusqueda } from '../../common/utils/busqueda.js';
import type { QueryCursosDto } from './dto/curso.dto.js';
import { Curso } from './entities/curso.entity.js';

export interface CursoDetalle {
  curso: Curso;
  creadoPorNombre: string | null;
  actualizadoPorNombre: string | null;
}

@Injectable()
export class CursosRepository {
  constructor(@InjectRepository(Curso) private readonly repo: Repository<Curso>) {}

  // creadoPor: solo los cursos que creo ese usuario (V-12 mientras no hay destinos); null = todos
  async listar(filtros: QueryCursosDto, creadoPor: string | null): Promise<{ cursos: CursoDetalle[]; total: number }> {
    const consulta = this.repo.createQueryBuilder('c');
    if (creadoPor) consulta.andWhere('c.creado_por = :creadoPor', { creadoPor });
    if (filtros.search) consulta.andWhere('c.titulo ILIKE :patron', { patron: patronBusqueda(filtros.search) });
    if (filtros.estado) consulta.andWhere('c.estado = :estado', { estado: filtros.estado });

    const total = await consulta.getCount();
    const resultado = await this.conAuditoria(consulta)
      .orderBy('c.actualizado_en', 'DESC')
      .offset(filtros.offset)
      .limit(filtros.limit)
      .getRawAndEntities();
    return { cursos: combinar(resultado), total };
  }

  async buscarDetalle(id: string): Promise<CursoDetalle | null> {
    const resultado = await this.conAuditoria(this.repo.createQueryBuilder('c').where('c.id = :id', { id })).getRawAndEntities();
    return combinar(resultado)[0] ?? null;
  }

  buscarPorId(id: string): Promise<Curso | null> {
    return this.repo.findOneBy({ id });
  }

  crear(datos: Partial<Curso>): Promise<Curso> {
    return this.repo.save(this.repo.create(datos));
  }

  // Bloqueo optimista (V-13): solo actualiza si nadie guardo despues de que se leyo.
  // date_trunc porque PostgreSQL guarda microsegundos y JavaScript solo milisegundos.
  // Devuelve false si la fila cambio; actualizado_en lo pone TypeORM.
  async actualizarSiNoCambio(id: string, leidoEn: Date, cambios: QueryDeepPartialEntity<Curso>): Promise<boolean> {
    const resultado = await this.repo
      .createQueryBuilder()
      .update(Curso)
      .set(cambios)
      .where('id = :id', { id })
      .andWhere(`date_trunc('milliseconds', actualizado_en) = :leidoEn`, { leidoEn })
      .execute();
    return resultado.affected === 1;
  }

  guardar(curso: Curso): Promise<Curso> {
    return this.repo.save(curso);
  }

  // D-36: suma de los materiales activos de los temas activos, en horas. Se llama en la misma transaccion
  // que cambia el contenido, y marca el curso como modificado por quien hizo el cambio.
  async recalcularDuracion(cursoId: string, actorId: string, manager: EntityManager): Promise<void> {
    await manager.query(
      `UPDATE cursos SET
         duracion_horas = coalesce((
           SELECT sum(m.duracion_segundos) FROM materiales m
           JOIN temas t ON t.id = m.tema_id
           WHERE t.curso_id = $1 AND t.activo AND m.activo
         ), 0) / 3600.0,
         actualizado_por = $2,
         actualizado_en = now()
       WHERE id = $1`,
      [cursoId, actorId],
    );
  }

  private conAuditoria(consulta: SelectQueryBuilder<Curso>): SelectQueryBuilder<Curso> {
    return consulta
      .leftJoin('usuarios', 'creador', 'creador.id = c.creado_por')
      .leftJoin('usuarios', 'editor', 'editor.id = c.actualizado_por')
      .addSelect(
        `concat_ws(' ', creador.username, creador.nombres, creador.apellido_paterno, creador.apellido_materno)`,
        'creado_por_nombre',
      )
      .addSelect(
        `concat_ws(' ', editor.username, editor.nombres, editor.apellido_paterno, editor.apellido_materno)`,
        'actualizado_por_nombre',
      );
  }
}

function combinar({ entities, raw }: { entities: Curso[]; raw: Record<string, unknown>[] }): CursoDetalle[] {
  return entities.map((curso) => {
    const fila = raw.find((r) => r.c_id === curso.id)!;
    return {
      curso,
      creadoPorNombre: (fila.creado_por_nombre as string) || null,
      actualizadoPorNombre: (fila.actualizado_por_nombre as string) || null,
    };
  });
}
