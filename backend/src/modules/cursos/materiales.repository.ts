import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { MaterialImagen } from './entities/material-imagen.entity.js';
import { Material } from './entities/material.entity.js';
import { guardarOrden, siguienteOrden } from './orden.js';

export type DatosMaterial = Pick<
  Material,
  'temaId' | 'tipo' | 'titulo' | 'descripcion' | 'archivoId' | 'urlExterna' | 'contenido' | 'textoExtraido' | 'duracionSegundos' | 'creadoPor'
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

  //el archivo de cada material y las imagenes de sus paginas
  async archivosDeTema(temaId: string): Promise<string[]> {
    const filas: { archivo_id: string }[] = await this.repo.query(
      `SELECT m.archivo_id FROM materiales m WHERE m.tema_id = $1 AND m.archivo_id IS NOT NULL
       UNION ALL
       SELECT i.archivo_id FROM materiales_imagenes i JOIN materiales m ON m.id = i.material_id WHERE m.tema_id = $1`,
      [temaId],
    );
    return filas.map((f) => f.archivo_id);
  }

  async imagenesDe(materialId: string): Promise<string[]> {
    const filas = await this.repo.manager.find(MaterialImagen, { where: { materialId }, select: { archivoId: true } });
    return filas.map((f) => f.archivoId);
  }

  async agregarImagenes(materialId: string, archivoIds: string[], actorId: string, manager: EntityManager): Promise<void> {
    if (archivoIds.length === 0) return;
    await manager.insert(
      MaterialImagen,
      archivoIds.map((archivoId) => ({ materialId, archivoId, creadoPor: actorId })),
    );
  }

  async quitarImagenes(materialId: string, archivoIds: string[], manager: EntityManager): Promise<void> {
    if (archivoIds.length === 0) return;
    await manager.delete(MaterialImagen, { materialId, archivoId: In(archivoIds) });
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
