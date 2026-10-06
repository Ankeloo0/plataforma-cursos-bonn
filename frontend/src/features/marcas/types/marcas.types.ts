import type { Auditoria } from '../../../types/api.types';

export interface Marca extends Auditoria {
  id: string;
  nombre: string;
  logoUrl: string | null;
  instruccionesAsistente: string | null;
  activo: boolean;
  sucursales: number;
  empresas: number;
}

export interface DatosMarca {
  nombre: string;
  instruccionesAsistente: string | null;
}
