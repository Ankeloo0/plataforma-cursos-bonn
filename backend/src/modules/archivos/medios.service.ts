import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { extractText } from 'unpdf';
import { AlmacenamientoService } from './almacenamiento.service.js';

const ejecutar = promisify(execFile);

// Lee datos de un archivo ya guardado: la duracion de un video (D-36) y el texto de un PDF (D-33)
@Injectable()
export class MediosService {
  private readonly logger = new Logger(MediosService.name);

  constructor(private readonly almacenamiento: AlmacenamientoService) {}

  // ffprobe solo lee el encabezado del video, no lo procesa: tarda menos de un segundo.
  // execFile no pasa por una shell, asi que la ruta no se puede usar para inyectar comandos.
  async duracionVideoSegundos(storageKey: string): Promise<number> {
    let salida: string;
    try {
      const { stdout } = await ejecutar(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', this.almacenamiento.rutaAbsoluta(storageKey)],
        { timeout: 30_000 },
      );
      salida = stdout;
    } catch (error) {
      // Sin ffprobe instalado es un error del servidor, no del archivo
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
      salida = '';
    }
    const segundos = Number.parseFloat(salida);
    if (!Number.isFinite(segundos) || segundos <= 0) {
      throw new UnprocessableEntityException({
        message: 'No se pudo leer el video. Prueba con otro archivo.',
        code: 'ARCHIVO_DANADO',
      });
    }
    return Math.round(segundos);
  }

  // Si el PDF no tiene texto (escaneado) o no se puede leer, devuelve null: el material se guarda igual
  async textoPdf(storageKey: string): Promise<string | null> {
    try {
      const datos = await readFile(this.almacenamiento.rutaAbsoluta(storageKey));
      const { text } = await extractText(new Uint8Array(datos), { mergePages: true });
      // PostgreSQL no acepta el caracter nulo en una columna text
      const limpio = text.replaceAll('\u0000', '').trim();
      return limpio || null;
    } catch (error) {
      this.logger.warn(`No se pudo extraer el texto de ${storageKey}: ${String(error)}`);
      return null;
    }
  }
}
