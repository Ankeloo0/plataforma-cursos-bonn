import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { Material } from './entities/material.entity.js';
import { guardarOrden, siguienteOrden } from './orden.js';

export type DatosMaterial = Pick<
  Material,
  'temaId' | 'tipo' | 'titulo' | 'descripcion' | 'archivoId' | 'urlExterna' | 'textoExtraido' | 'duracionSegundos' | 'creadoPor'
>;

@Injectable()
export class MaterialesRepository {
  constructor(@InjectRepository(Material) private readonly repo: Repository<Material>) {}

  // Con su archivo (nombre, tamano y estado) para mostrarlo en el editor
  listarPorTemas(temaIds: string[]): Promise<Material[]> {
    if (temaIds.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { temaId: In(temaIds) }, relations: { archivo: true }, order: { orden: 'ASC' } });
  }

  buscarPorId(id: string): Promise<Material | null> {
    return this.repo.findOne({ where: { id }, relations: { archivo: true } });
  }

  async archivosDeTema(temaId: string): Promise<string[]> {
    const materiales = await this.repo.find({ where: { temaId }, select: { archivoId: true } });
    return materiales.flatMap((m) => (m.archivoId ? [m.archivoId] : []));
  }

  async crear(datos: DatosMaterial, manager: EntityManager): Promise<Material> {
    const orden = await siguienteOrden(manager, 'materiales', 'tema_id', datos.temaId);
    return manager.save(manager.create(Material, { ...datos, orden }));
  }

  // Bloqueo optimista (V-13), igual que en cursos
  async actualizarSiNoCambio(
    id: string,
    leidoEn: Date,
    cambios: QueryDeepPartialEntity<Material>,
    manager: EntityManager,
  ): Promise<boolean> {
    const resultado = await manager
      .createQueryBuilder()
      .update(Material)
      .set(cambios)
      .where('id = :id', { id })
      .andWhere(`date_trunc('milliseconds', actualizado_en) = :leidoEn`, { leidoEn })
      .execute();
    return resultado.affected === 1;
  }

  async cambiarActivo(id: string, activo: boolean, actorId: string, manager: EntityManager): Promise<void> {
    await manager.update(Material, { id }, { activo, actualizadoPor: actorId });
  }

  async eliminar(id: string, manager: EntityManager): Promise<void> {
    await manager.delete(Material, { id });
  }

  reordenar(temaId: string, ids: string[], manager: EntityManager): Promise<void> {
    return guardarOrden(manager, 'materiales', 'tema_id', temaId, ids);
  }
}
