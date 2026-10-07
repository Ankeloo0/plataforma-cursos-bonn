import type { Auditoria } from '../../../types/api.types';

interface Referencia {
  id: string;
  nombre: string;
}

// `id` es el del empleado; `usuarioId` se usa para activar, desactivar, desbloquear y restablecer
export interface Empleado extends Auditoria {
  id: string;
  usuarioId: string;
  numeroEmpleado: string;
  fechaIngreso: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fotoUrl: string | null;
  activo: boolean;
  bloqueadoHasta: string | null;
  debeCambiarPassword: boolean;
  ultimoAccesoEn: string | null;
  puesto: Referencia;
  area: Referencia;
  sucursal: Referencia & { activo: boolean };
  empresa: Referencia;
  marca: Referencia;
}

export interface DatosEmpleado {
  sucursalId: string;
  numeroEmpleado: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  puestoId: string;
  fechaIngreso: string;
}

export interface FiltrosEmpleados {
  page: number;
  limit: number;
  search: string;
  sucursalId: string;
  areaId: string;
  puestoId: string;
  activo: 'todos' | 'true' | 'false';
}
