import type { MetaPaginacion } from '../components/ui/Paginacion';

export interface Paginado<T> {
  data: T[];
  meta: MetaPaginacion;
}

// Quien creo y quien modifico por ultima vez (RNF-17)
export interface Auditoria {
  creadoEn: string;
  creadoPor: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;
}
