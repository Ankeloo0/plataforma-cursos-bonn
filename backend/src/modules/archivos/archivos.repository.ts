import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Archivo } from './entities/archivo.entity.js';

// Foto: el usuario cuya foto es este archivo y su sucursal (null si no es empleado).
// Portada y material: quien creo el curso.
export type UsoDeArchivo =
  | { tipo: 'FOTO'; duenoId: string; sucursalDelDueno: string | null }
  | { tipo: 'PORTADA' | 'MATERIAL'; creadorDelCurso: string };

// Los archivos de materiales se suben antes de crear el material (technical-spec 4.8)
export const CARPETA_MATERIALES = 'materiales';

@Injectable()
export class ArchivosRepository {
  constructor(@InjectRepository(Archivo) private readonly repo: Repository<Archivo>) {}

  crear(datos: Pick<Archivo, 'storageKey' | 'nombreOriginal' | 'mimeType' | 'tamanoBytes' | 'creadoPor'>) {
    return this.repo.save(this.repo.create(datos));
  }

  buscarPorId(id: string): Promise<Archivo | null> {
    return this.repo.findOneBy({ id });
  }

  async eliminar(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async usadoPorMaterial(id: string): Promise<boolean> {
    const [fila] = await this.repo.query(`SELECT 1 FROM materiales WHERE archivo_id = $1 LIMIT 1`, [id]);
    return Boolean(fila);
  }

  // Solo la carpeta de materiales: fotos, logotipos y portadas se guardan en la misma peticion que los usa
  buscarMaterialesSinUsar(antesDe: Date): Promise<Pick<Archivo, 'id'>[]> {
    return this.repo.query(
      `SELECT a.id FROM archivos a
       WHERE a.storage_key LIKE $1 AND a.creado_en < $2
         AND NOT EXISTS (SELECT 1 FROM materiales m WHERE m.archivo_id = a.id)`,
      [`${CARPETA_MATERIALES}/%`, antesDe],
    );
  }

  // Quien usa el archivo decide quien puede verlo (database-design 4.1)
  async buscarUso(id: string): Promise<UsoDeArchivo | null> {
    const [foto] = await this.repo.query(`SELECT id, sucursal_id FROM usuarios WHERE foto_archivo_id = $1 LIMIT 1`, [id]);
    if (foto) return { tipo: 'FOTO', duenoId: foto.id, sucursalDelDueno: foto.sucursal_id };
    const [curso] = await this.repo.query(`SELECT creado_por FROM cursos WHERE imagen_archivo_id = $1 LIMIT 1`, [id]);
    if (curso) return { tipo: 'PORTADA', creadorDelCurso: curso.creado_por };
    const [material] = await this.repo.query(
      `SELECT c.creado_por FROM materiales m
       JOIN temas t ON t.id = m.tema_id
       JOIN cursos c ON c.id = t.curso_id
       WHERE m.archivo_id = $1 LIMIT 1`,
      [id],
    );
    if (material) return { tipo: 'MATERIAL', creadorDelCurso: material.creado_por };
    return null;
  }
}
