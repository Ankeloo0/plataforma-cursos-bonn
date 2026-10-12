import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { ArchivosRepository } from './archivos.repository.js';
import { ESTADOS_ARCHIVO } from './entities/archivo.entity.js';

const ejecutar = promisify(execFile);
// Un video de 500 MB tarda minutos; si pasa de una hora, algo anda mal
const TIEMPO_MAXIMO_MS = 60 * 60 * 1000;

// RF-04.6 y P-11: maximo 720 px de alto sin agrandar (altura par, como pide H.264), H.264 CRF 26 y AAC 128 kbps.
// yuv420p y faststart para que cualquier navegador lo reproduzca y empiece antes de descargarlo completo.
export function argumentosFfmpeg(entrada: string, salida: string): string[] {
  return [
    '-v', 'error', '-y', '-i', entrada,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', "scale=-2:'min(720,trunc(ih/2)*2)'",
    '-c:v', 'libx264', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    salida,
  ];
}

//comprime los videso, uno a la vez
@Injectable()
export class CompresionVideoService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CompresionVideoService.name);
  private readonly pendientes: string[] = [];
  private trabajando = false;
  private readonly detener = new AbortController();

  constructor(
    private readonly archivosRepository: ArchivosRepository,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  // Si la API se apago a media compresion, el original sigue intacto: se vuelve a empezar
  async onApplicationBootstrap(): Promise<void> {
    for (const id of await this.archivosRepository.idsConEstado(ESTADOS_ARCHIVO.PROCESANDO)) this.agregar(id);
  }

  onModuleDestroy(): void {
    this.detener.abort();
  }

  // El material ya se guardo: el video queda PROCESANDO y se comprime cuando le toque
  async encolar(archivoId: string): Promise<void> {
    await this.archivosRepository.cambiarEstado(archivoId, ESTADOS_ARCHIVO.PROCESANDO);
    this.agregar(archivoId);
  }

  private agregar(archivoId: string): void {
    this.pendientes.push(archivoId);
    void this.procesarPendientes();
  }

  private async procesarPendientes(): Promise<void> {
    if (this.trabajando) return;
    this.trabajando = true;
    try {
      let archivoId: string | undefined;
      while (!this.detener.signal.aborted && (archivoId = this.pendientes.shift())) {
        // Un error de la base no debe detener la fila ni tumbar la API
        await this.comprimir(archivoId).catch((error: unknown) => this.logger.error(`Compresion de ${archivoId}: ${String(error)}`));
      }
    } finally {
      this.trabajando = false;
    }
  }

  // Si falla, el original se queda y se puede ver; el editor muestra "Error"
  private async comprimir(archivoId: string): Promise<void> {
    const archivo = await this.archivosRepository.buscarPorId(archivoId);
    if (!archivo || archivo.estado !== ESTADOS_ARCHIVO.PROCESANDO) return;

    // En tmp/, dentro del storage: al terminar se mueve sin copiarlo
    const salida = path.join(this.almacenamiento.carpetaTemporal, `${randomUUID()}.mp4`);
    try {
      await mkdir(this.almacenamiento.carpetaTemporal, { recursive: true });
      await ejecutar('nice', ['-n', '10', 'ffmpeg', ...argumentosFfmpeg(this.almacenamiento.rutaAbsoluta(archivo.storageKey), salida)], {
        timeout: TIEMPO_MAXIMO_MS,
        signal: this.detener.signal,
      });

      const { size } = await stat(salida);
      // Un video que ya era ligero puede crecer al recomprimirlo: entonces se queda el original
      if (size >= Number(archivo.tamanoBytes)) {
        await this.archivosRepository.cambiarEstado(archivo.id, ESTADOS_ARCHIVO.LISTO);
        return;
      }

      const storageKey = `${path.posix.dirname(archivo.storageKey)}/${randomUUID()}.mp4`;
      await this.almacenamiento.mover(salida, storageKey);
      const guardado = await this.archivosRepository.guardarComprimido(archivo.id, storageKey, size);
      await this.almacenamiento.eliminar(guardado ? archivo.storageKey : storageKey);
    } catch (error) {
      // Al apagar la API se queda PROCESANDO y se retoma al volver a iniciar
      if (this.detener.signal.aborted) return;
      this.logger.error(`No se pudo comprimir ${archivo.storageKey}: ${String(error)}`);
      await this.archivosRepository.cambiarEstado(archivo.id, ESTADOS_ARCHIVO.ERROR);
    } finally {
      await rm(salida, { force: true });
    }
  }
}
