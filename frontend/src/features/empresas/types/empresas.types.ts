import type { Auditoria } from '../../../types/api.types';

export interface Empresa extends Auditoria {
  id: string;
  nombre: string;
  razonSocial: string | null;
  prefijoFolio: string;
  activo: boolean;
  sucursalesActivas: number;
  administradores: number;
  empleadosActivos: number;
}

export interface FiltrosEmpresas {
  page: number;
  limit: number;
  search: string;
  activo: 'todas' | 'true' | 'false';
}

export interface DatosEmpresa {
  nombre: string;
  razonSocial: string | null;
  prefijoFolio: string;
}

export interface Sucursal extends Auditoria {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  empresa: { id: string; nombre: string; activo: boolean };
  marca: { id: string; nombre: string };
  administradores: { id: string; nombre: string }[];
  empleadosActivos: number;
}

export interface DatosSucursal {
  nombre: string;
  marcaId: string;
  direccion: string | null;
}
