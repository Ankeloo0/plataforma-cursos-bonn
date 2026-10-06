import type { Permiso } from '../../auth/types/auth.types';

export interface Administrador {
  id: string;
  rol: string;
  username: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fotoUrl: string | null;
  activo: boolean;
  bloqueadoHasta: string | null;
  debeCambiarPassword: boolean;
  ultimoAccesoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface AdministradorResumen extends Administrador {
  totalPermisos: number;
  totalSucursales: number;
}

export interface SucursalDeAlcance {
  id: string;
  nombre: string;
  activo: boolean;
  empresa: { id: string; nombre: string; activo: boolean };
  marca: { id: string; nombre: string };
}

export interface AdministradorDetalle extends Administrador {
  permisos: Permiso[];
  sucursales: SucursalDeAlcance[];
}

export interface DatosAdministrador {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  username: string;
}

export interface FiltrosAdministradores {
  page: number;
  limit: number;
  search: string;
  activo: 'todos' | 'true' | 'false';
}

export type GrupoPermisos = 'CATALOGOS' | 'EMPLEADOS' | 'CURSOS' | 'RESULTADOS' | 'ASISTENTE';

export interface DescripcionPermiso {
  permiso: Permiso;
  grupo: GrupoPermisos;
  nombre: string;
  descripcion: string;
  alcance: 'TODA_LA_PLATAFORMA' | 'SUS_SUCURSALES';
}

export interface PlantillaPermisos {
  clave: string;
  nombre: string;
  permisos: Permiso[];
}

export interface CatalogoPermisos {
  permisos: DescripcionPermiso[];
  plantillas: PlantillaPermisos[];
}
