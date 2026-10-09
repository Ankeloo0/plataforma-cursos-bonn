import { urlArchivo } from '../../archivos/archivos.service.js';
import type { EstadoArchivo } from '../../archivos/entities/archivo.entity.js';
import type { Material, TipoMaterial } from '../entities/material.entity.js';
import type { Tema } from '../entities/tema.entity.js';

export class ArchivoDeMaterialDto {
  id: string;
  url: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  // PROCESANDO o ERROR mientras se comprime un video (I3.4, D-35)
  estado: EstadoArchivo;
}

export class MaterialResponseDto {
  id: string;
  temaId: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoMaterial;
  orden: number;
  // false = oculto (D-32)
  activo: boolean;
  // Video: lo que dura. Los demas tipos: 0 (D-36)
  duracionSegundos: number;
  archivo: ArchivoDeMaterialDto | null;
  urlExterna: string | null;
  actualizadoEn: string;

  // texto_extraido no se envia: solo lo usa el asistente
  static desde(material: Material): MaterialResponseDto {
    const archivo = material.archivo;
    return {
      id: material.id,
      temaId: material.temaId,
      titulo: material.titulo,
      descripcion: material.descripcion,
      tipo: material.tipo,
      orden: material.orden,
      activo: material.activo,
      duracionSegundos: material.duracionSegundos,
      archivo: archivo
        ? {
            id: archivo.id,
            url: urlArchivo(archivo.id)!,
            nombreOriginal: archivo.nombreOriginal,
            mimeType: archivo.mimeType,
            tamanoBytes: Number(archivo.tamanoBytes),
            estado: archivo.estado,
          }
        : null,
      urlExterna: material.urlExterna,
      actualizadoEn: material.actualizadoEn.toISOString(),
    };
  }
}

export class TemaResponseDto {
  id: string;
  cursoId: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  actualizadoEn: string;
  // En orden, incluidos los ocultos: el editor los muestra con su chip
  materiales: MaterialResponseDto[];

  static desde(tema: Tema, materiales: Material[]): TemaResponseDto {
    return {
      id: tema.id,
      cursoId: tema.cursoId,
      titulo: tema.titulo,
      descripcion: tema.descripcion,
      orden: tema.orden,
      activo: tema.activo,
      actualizadoEn: tema.actualizadoEn.toISOString(),
      materiales: materiales.map((m) => MaterialResponseDto.desde(m)),
    };
  }
}
