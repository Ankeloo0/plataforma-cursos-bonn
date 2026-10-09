import { ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Response } from 'express';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import { ROLES } from '../../common/constants/roles.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { ArchivosRepository, CARPETA_MATERIALES } from './archivos.repository.js';
import { ArchivoSubidoDto, type TipoArchivoMaterial } from './dto/archivo-subido.dto.js';
import type { Archivo } from './entities/archivo.entity.js';

export const FOTO_TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;
const FOTO_LADO_PX = 512;
// Portadas (P-10, P-11): hasta 50 MB al subir; se guardan con el lado mayor de 1280 px como maximo
export const PORTADA_TAMANO_MAXIMO_BYTES = 50 * 1024 * 1024;
const PORTADA_LADO_MAYOR_PX = 1280;
const IMAGEN_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

// Archivos de materiales (P-10): el limite de Multer es el mayor; el de cada tipo se revisa con su tipo real
const MB = 1024 * 1024;
export const MATERIAL_TAMANO_MAXIMO_BYTES = 500 * MB;
const DOCUMENTO = { tipo: 'DOCUMENTO', maximo: 50 * MB } as const;
const TIPOS_DE_MATERIAL: Record<string, { tipo: TipoArchivoMaterial; maximo: number }> = {
  'video/mp4': { tipo: 'VIDEO', maximo: MATERIAL_TAMANO_MAXIMO_BYTES },
  'application/pdf': { tipo: 'PDF', maximo: 50 * MB },
  'image/jpeg': { tipo: 'IMAGEN', maximo: 50 * MB },
  'image/png': { tipo: 'IMAGEN', maximo: 50 * MB },
  'image/webp': { tipo: 'IMAGEN', maximo: 50 * MB },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DOCUMENTO,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': DOCUMENTO,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': DOCUMENTO,
};
// Un archivo subido que ningun material usa se borra despues de este tiempo (RF-04.5)
const HORAS_ARCHIVO_SIN_USAR = 24;

export function urlArchivo(archivoId: string | null): string | null {
  return archivoId ? `/api/v1/archivos/${archivoId}/contenido` : null;
}

@Injectable()
export class ArchivosService {
  private readonly logger = new Logger(ArchivosService.name);
  private readonly entregarConNginx: boolean;

  constructor(
    private readonly archivosRepository: ArchivosRepository,
    private readonly almacenamiento: AlmacenamientoService,
    config: ConfigService,
  ) {
    // En produccion nginx envia el archivo (T-06); en desarrollo y en pruebas lo envia Node
    this.entregarConNginx = config.get<string>('env') === 'production';
  }

  // Foto de perfil (P-45): JPG, PNG o WebP hasta 5 MB, recortada a 512 x 512 y guardada como WebP
  async guardarFoto(archivo: Express.Multer.File | undefined, usuarioId: string): Promise<Archivo> {
    const imagen = await this.validarImagen(archivo, FOTO_TAMANO_MAXIMO_BYTES, 'La foto');
    const contenido = await this.convertir(() =>
      sharp(imagen.buffer)
        .rotate()
        .resize(FOTO_LADO_PX, FOTO_LADO_PX, { fit: 'cover', position: 'attention' })
        .webp({ quality: 85 })
        .toBuffer(),
    );
    return this.guardarWebp(contenido, 'fotos', imagen.originalname, usuarioId);
  }

  // Portada de un curso (RF-04.6): sin recortar, con el lado mayor de 1280 px como maximo y sin agrandar
  // una imagen mas chica. En WebP con calidad 80 pesa de 100 a 300 KB.
  async guardarPortada(archivo: Express.Multer.File | undefined, usuarioId: string): Promise<Archivo> {
    const imagen = await this.validarImagen(archivo, PORTADA_TAMANO_MAXIMO_BYTES, 'La portada');
    const contenido = await this.convertir(() =>
      sharp(imagen.buffer)
        .rotate()
        .resize(PORTADA_LADO_MAYOR_PX, PORTADA_LADO_MAYOR_PX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
    );
    return this.guardarWebp(contenido, 'portadas', imagen.originalname, usuarioId);
  }

  // Primer paso de un material (technical-spec 4.8): Multer ya escribio el archivo en tmp/.
  // El temporal se borra siempre al final: si se guardo, ya se movio a su lugar.
  async guardarMaterial(archivo: Express.Multer.File | undefined, usuarioId: string): Promise<ArchivoSubidoDto> {
    if (!archivo) {
      throw new UnprocessableEntityException({ message: 'Selecciona un archivo.', code: 'ARCHIVO_REQUERIDO' });
    }
    try {
      const detectado = await fileTypeFromFile(archivo.path);
      const permitido = detectado ? TIPOS_DE_MATERIAL[detectado.mime] : undefined;
      if (!detectado || !permitido) {
        throw new UnprocessableEntityException({
          message: 'Sube un video MP4, un PDF, una imagen JPG, PNG o WebP, o un documento de Word, Excel o PowerPoint.',
          code: 'ARCHIVO_TIPO_NO_PERMITIDO',
        });
      }
      if (archivo.size > permitido.maximo) {
        throw new UnprocessableEntityException({
          message: `El archivo pesa más de ${permitido.maximo / MB} MB, el máximo para este tipo.`,
          code: 'ARCHIVO_DEMASIADO_GRANDE',
        });
      }

      const guardado =
        permitido.tipo === 'IMAGEN'
          ? await this.guardarImagenMaterial(archivo, usuarioId)
          : await this.moverMaterial(archivo, detectado.mime, detectado.ext, usuarioId);
      return ArchivoSubidoDto.desde(guardado, permitido.tipo);
    } finally {
      await rm(archivo.path, { force: true });
    }
  }

  // Cancelar una subida: solo quien la hizo y mientras ningun material use el archivo
  async cancelarSubida(archivoId: string, usuarioId: string): Promise<void> {
    const archivo = await this.archivosRepository.buscarPorId(archivoId);
    if (!archivo || archivo.creadoPor !== usuarioId || !archivo.storageKey.startsWith(`${CARPETA_MATERIALES}/`)) {
      throw new NotFoundException({ message: 'El archivo no existe.', code: 'ARCHIVO_NO_ENCONTRADO' });
    }
    if (await this.archivosRepository.usadoPorMaterial(archivo.id)) {
      throw new ConflictException({ message: 'El archivo ya se usa en un material.', code: 'ARCHIVO_EN_USO' });
    }
    await this.eliminar(archivo.id);
  }

  // Segundo paso: el servicio de materiales solo acepta un archivo que subio quien guarda y que
  // ningun material usa todavia; asi nadie puede poner en su curso el archivo de otra persona.
  async exigirParaMaterial(archivoId: string, usuarioId: string): Promise<{ archivo: Archivo; tipo: TipoArchivoMaterial }> {
    const noDisponible = new UnprocessableEntityException({
      message: 'El archivo ya no está disponible. Súbelo de nuevo.',
      code: 'ARCHIVO_NO_DISPONIBLE',
    });
    const archivo = await this.archivosRepository.buscarPorId(archivoId);
    if (!archivo || archivo.creadoPor !== usuarioId || !archivo.storageKey.startsWith(`${CARPETA_MATERIALES}/`)) {
      throw noDisponible;
    }
    const tipo = TIPOS_DE_MATERIAL[archivo.mimeType]?.tipo;
    if (!tipo || (await this.archivosRepository.usadoPorMaterial(archivo.id))) throw noDisponible;
    return { archivo, tipo };
  }

  // Tarea diaria (technical-spec 4.9): archivos de materiales que nadie uso y temporales abandonados
  @Cron('0 3 * * *', { name: 'limpiar-archivos-sin-usar' })
  async limpiarSinUsar(): Promise<void> {
    const antesDe = new Date(Date.now() - HORAS_ARCHIVO_SIN_USAR * 60 * 60 * 1000);
    const sinUsar = await this.archivosRepository.buscarMaterialesSinUsar(antesDe);
    for (const { id } of sinUsar) await this.eliminar(id);
    const temporales = await this.almacenamiento.limpiarTemporales(antesDe);
    if (sinUsar.length || temporales) {
      this.logger.log(`Limpieza: ${sinUsar.length} archivos sin usar y ${temporales} temporales borrados`);
    }
  }

  async eliminar(archivoId: string): Promise<void> {
    const archivo = await this.archivosRepository.buscarPorId(archivoId);
    if (!archivo) return;
    await this.archivosRepository.eliminar(archivo.id);
    // Si borrar el archivo fisico falla, la fila ya no existe: solo queda un archivo huerfano en disco
    await this.almacenamiento.eliminar(archivo.storageKey).catch((error: unknown) => {
      this.logger.warn(`No se pudo borrar ${archivo.storageKey}: ${String(error)}`);
    });
  }

  async entregar(archivoId: string, sesion: UsuarioSesion, res: Response): Promise<void> {
    const archivo = await this.archivosRepository.buscarPorId(archivoId);
    if (!archivo || !(await this.puedeVer(archivo.id, sesion))) {
      // 404 y no 403, para no revelar que el archivo existe (technical-spec 4.14)
      throw new NotFoundException({ message: 'El archivo no existe.', code: 'ARCHIVO_NO_ENCONTRADO' });
    }

    res.setHeader('Content-Type', archivo.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    // Un documento se descarga con su nombre original y no con el uuid del storage
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(archivo.nombreOriginal)}`);

    if (this.entregarConNginx) {
      // La API ya reviso el permiso; nginx lee el archivo del disco y lo envia sin ocupar a Node.
      // /_protegido/ es "internal" en nginx: el navegador no puede pedirla directamente.
      res.setHeader('X-Accel-Redirect', `/_protegido/${archivo.storageKey}`);
      res.end();
      return;
    }
    // En desarrollo: sendFile tambien responde por rangos (Range) para adelantar videos
    res.sendFile(this.almacenamiento.rutaAbsoluta(archivo.storageKey));
  }

  private async validarImagen(
    archivo: Express.Multer.File | undefined,
    maximoBytes: number,
    nombre: string,
  ): Promise<Express.Multer.File> {
    if (!archivo) {
      throw new UnprocessableEntityException({ message: 'Selecciona una imagen.', code: 'ARCHIVO_REQUERIDO' });
    }
    if (archivo.size > maximoBytes) {
      throw new UnprocessableEntityException({
        message: `${nombre} pesa más de ${maximoBytes / (1024 * 1024)} MB. Elige una imagen más ligera.`,
        code: 'ARCHIVO_DEMASIADO_GRANDE',
      });
    }
    // Tipo real por contenido, nunca por la extension ni el Content-Type del cliente
    const tipo = await fileTypeFromBuffer(archivo.buffer);
    if (!tipo || !IMAGEN_TIPOS_PERMITIDOS.includes(tipo.mime)) {
      throw new UnprocessableEntityException({
        message: `${nombre} debe ser una imagen JPG, PNG o WebP.`,
        code: 'ARCHIVO_TIPO_NO_PERMITIDO',
      });
    }
    return archivo;
  }

  private async convertir(conversion: () => Promise<Buffer>): Promise<Buffer> {
    try {
      return await conversion();
    } catch {
      throw new UnprocessableEntityException({
        message: 'No se pudo leer la imagen. Prueba con otro archivo.',
        code: 'ARCHIVO_DANADO',
      });
    }
  }

  // Imagen de un material: como la portada, 1280 px en su lado mayor y WebP (P-11)
  private async guardarImagenMaterial(archivo: Express.Multer.File, usuarioId: string): Promise<Archivo> {
    const contenido = await this.convertir(() =>
      sharp(archivo.path)
        .rotate()
        .resize(PORTADA_LADO_MAYOR_PX, PORTADA_LADO_MAYOR_PX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
    );
    return this.guardarWebp(contenido, CARPETA_MATERIALES, archivo.originalname, usuarioId);
  }

  // Video, PDF o documento: se mueve del temporal sin cargarlo en memoria
  private async moverMaterial(archivo: Express.Multer.File, mimeType: string, extension: string, usuarioId: string): Promise<Archivo> {
    const storageKey = `${this.carpetaDelMes(CARPETA_MATERIALES)}/${randomUUID()}.${extension}`;
    await this.almacenamiento.mover(archivo.path, storageKey);
    try {
      return await this.archivosRepository.crear({
        storageKey,
        nombreOriginal: archivo.originalname.slice(0, 255),
        mimeType,
        tamanoBytes: String(archivo.size),
        creadoPor: usuarioId,
      });
    } catch (error) {
      await this.almacenamiento.eliminar(storageKey);
      throw error;
    }
  }

  private carpetaDelMes(carpeta: string): string {
    const ahora = new Date();
    return `${carpeta}/${ahora.getFullYear()}/${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  }

  private async guardarWebp(contenido: Buffer, carpeta: string, nombreOriginal: string, usuarioId: string): Promise<Archivo> {
    const storageKey = `${this.carpetaDelMes(carpeta)}/${randomUUID()}.webp`;

    await this.almacenamiento.guardar(contenido, storageKey);
    try {
      return await this.archivosRepository.crear({
        storageKey,
        nombreOriginal: nombreOriginal.slice(0, 255),
        mimeType: 'image/webp',
        tamanoBytes: String(contenido.length),
        creadoPor: usuarioId,
      });
    } catch (error) {
      await this.almacenamiento.eliminar(storageKey);
      throw error;
    }
  }

  // La foto de un empleado la ven sus companeros de sucursal y los administradores de esa sucursal;
  // la de un administrador, solo el y el superusuario (technical-spec 4.8).
  // La portada y los materiales de un curso, quien puede ver el curso: por ahora el superusuario y su
  // creador (V-12). Con los destinos de I4 los veran tambien los administradores y empleados a los que llega.
  private async puedeVer(archivoId: string, sesion: UsuarioSesion): Promise<boolean> {
    const uso = await this.archivosRepository.buscarUso(archivoId);
    if (!uso) return false;
    if (sesion.rol === ROLES.SUPERUSUARIO) return true;
    if (uso.tipo !== 'FOTO') return uso.creadorDelCurso === sesion.id;
    if (uso.duenoId === sesion.id) return true;
    if (!uso.sucursalDelDueno) return false;
    return uso.sucursalDelDueno === sesion.sucursalId || sesion.alcance.sucursalIds.includes(uso.sucursalDelDueno);
  }
}
