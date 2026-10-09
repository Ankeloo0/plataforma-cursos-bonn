import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { Tema } from './entities/tema.entity.js';
import { guardarOrden, siguienteOrden } from './orden.js';

@Injectable()
export class TemasRepository {
  constructor(@InjectRepository(Tema) private readonly repo: Repository<Tema>) {}

  listarPorCurso(cursoId: string): Promise<Tema[]> {
    return this.repo.find({ where: { cursoId }, order: { orden: 'ASC' } });
  }

  buscarPorId(id: string): Promise<Tema | null> {
    return this.repo.findOneBy({ id });
  }

  async crear(datos: Pick<Tema, 'cursoId' | 'titulo' | 'descripcion' | 'creadoPor'>, manager: EntityManager): Promise<Tema> {
    const orden = await siguienteOrden(manager, 'temas', 'curso_id', datos.cursoId);
    return manager.save(manager.create(Tema, { ...datos, orden }));
  }

  // Bloqueo optimista (V-13), igual que en cursos
  async actualizarSiNoCambio(id: string, leidoEn: Date, cambios: QueryDeepPartialEntity<Tema>, manager: EntityManager): Promise<boolean> {
    const resultado = await manager
      .createQueryBuilder()
      .update(Tema)
      .set(cambios)
      .where('id = :id', { id })
      .andWhere(`date_trunc('milliseconds', actualizado_en) = :leidoEn`, { leidoEn })
      .execute();
    return resultado.affected === 1;
  }

  async cambiarActivo(id: string, activo: boolean, actorId: string, manager: EntityManager): Promise<void> {
    await manager.update(Tema, { id }, { activo, actualizadoPor: actorId });
  }

  // Sus materiales se borran en cascada (database-design 4.3)
  async eliminar(id: string, manager: EntityManager): Promise<void> {
    await manager.delete(Tema, { id });
  }

  reordenar(cursoId: string, ids: string[], manager: EntityManager): Promise<void> {
    return guardarOrden(manager, 'temas', 'curso_id', cursoId, ids);
  }
}
