import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { link, mkdir, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Guarda los archivos en una carpeta del servidor (el volumen "storage" de Docker).
// En la base solo se guarda la ruta relativa (storage_key), nunca el contenido.
@Injectable()
export class AlmacenamientoService {
  private readonly raiz: string;
  // Multer escribe aqui los archivos grandes; esta dentro del storage para moverlos sin copiarlos
  readonly carpetaTemporal: string;

  constructor(config: ConfigService) {
    this.raiz = path.resolve(config.get<string>('storage.localPath') ?? '/storage');
    this.carpetaTemporal = path.join(this.raiz, 'tmp');
  }

  async guardar(contenido: Buffer, storageKey: string): Promise<void> {
    const destino = this.rutaAbsoluta(storageKey);
    await mkdir(path.dirname(destino), { recursive: true });
    // wx: falla si el archivo ya existe, asi nunca se sobrescribe otro
    await writeFile(destino, contenido, { flag: 'wx' });
  }

  // link falla si el destino ya existe (nunca sobrescribe) y no copia los datos: es el mismo disco
  async mover(rutaTemporal: string, storageKey: string): Promise<void> {
    const destino = this.rutaAbsoluta(storageKey);
    await mkdir(path.dirname(destino), { recursive: true });
    await link(rutaTemporal, destino);
    await unlink(rutaTemporal);
  }

  async eliminar(storageKey: string): Promise<void> {
    await rm(this.rutaAbsoluta(storageKey), { force: true });
  }

  // Temporales que quedaron de una subida interrumpida (por ejemplo, si la API se reinicio)
  async limpiarTemporales(antesDe: Date): Promise<number> {
    const nombres = await readdir(this.carpetaTemporal).catch(() => [] as string[]);
    let borrados = 0;
    for (const nombre of nombres) {
      const ruta = path.join(this.carpetaTemporal, nombre);
      const info = await stat(ruta).catch(() => null);
      if (info?.isFile() && info.mtime < antesDe) {
        await rm(ruta, { force: true });
        borrados++;
      }
    }
    return borrados;
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
