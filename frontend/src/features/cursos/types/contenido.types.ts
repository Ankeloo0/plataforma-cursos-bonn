export type TipoMaterial = 'VIDEO' | 'PDF' | 'IMAGEN' | 'DOCUMENTO' | 'ENLACE' | 'ARTICULO';
export type TipoArchivo = Exclude<TipoMaterial, 'ENLACE' | 'ARTICULO'>;

export interface ArchivoDeMaterial {
  id: string;
  url: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  // PROCESANDO o ERROR mientras se comprime un video (I3.4)
  estado: 'LISTO' | 'PROCESANDO' | 'ERROR';
}

export interface Material {
  id: string;
  temaId: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoMaterial;
  orden: number;
  // false = oculto
  activo: boolean;
  duracionSegundos: number;
  archivo: ArchivoDeMaterial | null;
  urlExterna: string | null;
  actualizadoEn: string;
}

export interface Tema {
  id: string;
  cursoId: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  actualizadoEn: string;
  materiales: Material[];
}

// Respuesta de POST /archivos: el primer paso de un material
export interface ArchivoSubido {
  id: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  tipoMaterial: TipoArchivo;
}

export interface DatosTema {
  titulo: string;
  descripcion: string | null;
}

export interface DatosMaterial {
  titulo: string;
  descripcion: string | null;
  archivoId?: string;
  urlExterna?: string;
}
