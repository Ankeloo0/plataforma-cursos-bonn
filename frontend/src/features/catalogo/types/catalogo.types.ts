import type { Auditoria } from '../../../types/api.types';

// Empleados activos, sucursales y empresas que lo usan (RN-02.6)
export interface Uso {
  empleados: number;
  sucursales: number;
  empresas: number;
}

export interface Area extends Auditoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  puestos: number;
  puestosActivos: number;
  uso: Uso;
}

export interface Puesto extends Auditoria {
  id: string;
  area: { id: string; nombre: string; activo: boolean };
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  uso: Uso;
}

export interface DatosArea {
  nombre: string;
  descripcion: string | null;
}

export interface DatosPuesto extends DatosArea {
  areaId: string;
}
