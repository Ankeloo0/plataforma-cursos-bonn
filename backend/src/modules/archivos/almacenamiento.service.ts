import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Guarda los archivos en una carpeta del servidor (el volumen "storage" de Docker).
// En la base solo se guarda la ruta relativa (storage_key), nunca el contenido.
@Injectable()
export class AlmacenamientoService {
  private readonly raiz: string;

  constructor(config: ConfigService) {
    this.raiz = path.resolve(config.get<string>('storage.localPath') ?? '/storage');
  }

  async guardar(contenido: Buffer, storageKey: string): Promise<void> {
    const destino = this.rutaAbsoluta(storageKey);
    await mkdir(path.dirname(destino), { recursive: true });
    // wx: falla si el archivo ya existe, asi nunca se sobrescribe otro
    await writeFile(destino, contenido, { flag: 'wx' });
  }

  async eliminar(storageKey: string): Promise<void> {
    await rm(this.rutaAbsoluta(storageKey), { force: true });
  }

  rutaAbsoluta(storageKey: string): string {
    const ruta = path.resolve(this.raiz, storageKey);
    // Evita que una storage_key con ../ apunte fuera de la carpeta del storage
    if (!ruta.startsWith(this.raiz + path.sep)) {
      throw new Error(`storage_key fuera del storage: ${storageKey}`);
    }
    return ruta;
  }
}
