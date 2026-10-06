import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Archivo } from './entities/archivo.entity.js';

export interface UsoDeArchivo {
  // Usuario cuya foto es este archivo y su sucursal (null si no es empleado)
  duenoId: string;
  sucursalDelDueno: string | null;
}

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

  // Quien usa el archivo decide quien puede verlo (database-design 4.1). Por ahora solo hay fotos de perfil.
  async buscarUso(id: string): Promise<UsoDeArchivo | null> {
    const [foto] = await this.repo.query(`SELECT id, sucursal_id FROM usuarios WHERE foto_archivo_id = $1 LIMIT 1`, [id]);
    return foto ? { duenoId: foto.id, sucursalDelDueno: foto.sucursal_id } : null;
  }
}
