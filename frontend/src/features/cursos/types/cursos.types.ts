import type { Auditoria } from '../../../types/api.types';

export type EstadoCurso = 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';

export interface Curso extends Auditoria {
  id: string;
  titulo: string;
  descripcion: string | null;
  // null = portada generica (RF-04.2)
  portadaUrl: string | null;
  // La calcula el sistema con sus videos; 0 si todavia no tiene
  duracionHoras: number;
  esObligatorio: boolean;
  fechaLimite: string | null;
  calificacionMinima: number;
  estado: EstadoCurso;
  publicadoEn: string | null;
  puedeEditar: boolean;
}

export interface DatosCurso {
  titulo: string;
  descripcion: string | null;
  esObligatorio: boolean;
  fechaLimite: string | null;
  calificacionMinima: number;
}

export interface FiltrosCursos {
  page: number;
  limit: number;
  search: string;
  estado: 'todos' | EstadoCurso;
}
