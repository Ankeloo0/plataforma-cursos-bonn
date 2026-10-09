import type { Archivo } from '../entities/archivo.entity.js';

// Los tipos de material que llevan archivo; el enlace y el articulo no tienen
export type TipoArchivoMaterial = 'VIDEO' | 'PDF' | 'IMAGEN' | 'DOCUMENTO';

export class ArchivoSubidoDto {
  id: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  // El tipo de material que le corresponde por su contenido real
  tipoMaterial: TipoArchivoMaterial;

  static desde(archivo: Archivo, tipoMaterial: TipoArchivoMaterial): ArchivoSubidoDto {
    return {
      id: archivo.id,
      nombreOriginal: archivo.nombreOriginal,
      mimeType: archivo.mimeType,
      tamanoBytes: Number(archivo.tamanoBytes),
      tipoMaterial,
    };
  }
}
