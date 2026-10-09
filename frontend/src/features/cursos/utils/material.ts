import { AlignLeft, FileDown, FileText, ImageIcon, Link, Video, type LucideIcon } from 'lucide-react';
import type { Material, TipoArchivo, TipoMaterial } from '../types/contenido.types';

const MB = 1024 * 1024;

interface InfoTipo {
  etiqueta: string;
  icono: LucideIcon;
  descripcion: string;
}

export const TIPOS_MATERIAL: Record<TipoMaterial, InfoTipo> = {
  VIDEO: { etiqueta: 'Video', icono: Video, descripcion: 'MP4 de hasta 500 MB' },
  PDF: { etiqueta: 'PDF', icono: FileText, descripcion: 'Manuales y guías' },
  IMAGEN: { etiqueta: 'Imagen', icono: ImageIcon, descripcion: 'JPG, PNG o WebP' },
  DOCUMENTO: { etiqueta: 'Documento', icono: FileDown, descripcion: 'Word, Excel o PowerPoint' },
  ENLACE: { etiqueta: 'Enlace', icono: Link, descripcion: 'Una página externa' },
  ARTICULO: { etiqueta: 'Artículo', icono: AlignLeft, descripcion: 'Texto escrito aquí' },
};

// Los articulos llegan en I3.3
export const TIPOS_DISPONIBLES: TipoMaterial[] = ['VIDEO', 'PDF', 'IMAGEN', 'DOCUMENTO', 'ENLACE'];

// Mismos tipos y limites que valida la API (P-10); aqui solo evitan subir un archivo que se rechazara
export const ARCHIVO_POR_TIPO: Record<TipoArchivo, { accept: string; maximo: number; ayuda: string }> = {
  VIDEO: { accept: 'video/mp4', maximo: 500 * MB, ayuda: 'MP4 de hasta 500 MB.' },
  PDF: { accept: 'application/pdf', maximo: 50 * MB, ayuda: 'PDF de hasta 50 MB.' },
  IMAGEN: {
    accept: 'image/jpeg,image/png,image/webp',
    maximo: 50 * MB,
    ayuda: 'JPG, PNG o WebP de hasta 50 MB. Se guarda a 1280 px en su lado mayor.',
  },
  DOCUMENTO: {
    accept: '.docx,.xlsx,.pptx',
    maximo: 50 * MB,
    ayuda: 'Word, Excel o PowerPoint (.docx, .xlsx, .pptx) de hasta 50 MB.',
  },
};

export function esTipoArchivo(tipo: TipoMaterial): tipo is TipoArchivo {
  return tipo in ARCHIVO_POR_TIPO;
}

// "2.3 MB", "850 KB"
export function tamano(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// "12 min", "1 h 5 min", "45 s"
export function duracionCorta(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.round(segundos / 60);
  const h = Math.floor(minutos / 60);
  const min = minutos % 60;
  if (h === 0) return `${min} min`;
  return min === 0 ? `${h} h` : `${h} h ${min} min`;
}

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// El dato de cada fila del plan: "Video · 12 min", "PDF · 2.3 MB", "Enlace · youtube.com"
export function detalleMaterial(material: Material): string {
  const etiqueta = TIPOS_MATERIAL[material.tipo].etiqueta;
  if (material.tipo === 'VIDEO') return `${etiqueta} · ${duracionCorta(material.duracionSegundos)}`;
  if (material.tipo === 'ENLACE' && material.urlExterna) return `${etiqueta} · ${dominio(material.urlExterna)}`;
  if (material.archivo) return `${etiqueta} · ${tamano(material.archivo.tamanoBytes)}`;
  return etiqueta;
}

// El nombre del archivo sin su extension, como titulo inicial del material
export function tituloDesdeArchivo(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '').slice(0, 150);
}
