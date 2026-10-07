import { Archive, FilePen, Send, type LucideIcon } from 'lucide-react';
import type { TonoChip } from '../../../components/ui/Chip';
import type { EstadoCurso } from '../types/cursos.types';

export const ESTADO_CURSO: Record<EstadoCurso, { etiqueta: string; tono: TonoChip; icono: LucideIcon }> = {
  BORRADOR: { etiqueta: 'Borrador', tono: 'neutro', icono: FilePen },
  PUBLICADO: { etiqueta: 'Publicado', tono: 'exito', icono: Send },
  ARCHIVADO: { etiqueta: 'Archivado', tono: 'aviso', icono: Archive },
};

// "1 h 25 min", "40 min", "2 h"
export function duracion(horas: number): string {
  const minutos = Math.round(horas * 60);
  const h = Math.floor(minutos / 60);
  const min = minutos % 60;
  if (h === 0) return `${min} min`;
  return min === 0 ? `${h} h` : `${h} h ${min} min`;
}
