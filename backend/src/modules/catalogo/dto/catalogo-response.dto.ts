import { ReferenciaConEstadoDto } from '../../../common/dto/referencia.dto.js';
import type { AreaConUso, PuestoConUso } from '../catalogo.repository.js';

// Empleados activos, sucursales y empresas que lo usan (RN-02.6)
export class UsoDto {
  empleados: number;
  sucursales: number;
  empresas: number;
}

export class AreaResponseDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  puestos: number;
  puestosActivos: number;
  uso: UsoDto;
  creadoEn: string;
  creadoPor: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;

  static desde({ area, puestos, puestosActivos, uso, creadoPorNombre, actualizadoPorNombre }: AreaConUso): AreaResponseDto {
    return {
      id: area.id,
      nombre: area.nombre,
      descripcion: area.descripcion,
      activo: area.activo,
      puestos,
      puestosActivos,
      uso,
      creadoEn: area.creadoEn.toISOString(),
      creadoPor: creadoPorNombre,
      actualizadoEn: area.actualizadoEn.toISOString(),
      actualizadoPor: area.actualizadoPor ? actualizadoPorNombre : null,
    };
  }
}

export class PuestoResponseDto {
  id: string;
  area: ReferenciaConEstadoDto;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  uso: UsoDto;
  creadoEn: string;
  creadoPor: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;

  static desde({ puesto, area, uso, creadoPorNombre, actualizadoPorNombre }: PuestoConUso): PuestoResponseDto {
    return {
      id: puesto.id,
      area,
      nombre: puesto.nombre,
      descripcion: puesto.descripcion,
      activo: puesto.activo,
      uso,
      creadoEn: puesto.creadoEn.toISOString(),
      creadoPor: creadoPorNombre,
      actualizadoEn: puesto.actualizadoEn.toISOString(),
      actualizadoPor: puesto.actualizadoPor ? actualizadoPorNombre : null,
    };
  }
}
