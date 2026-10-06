import { ReferenciaConEstadoDto, ReferenciaDto } from '../../../common/dto/referencia.dto.js';
import type { SucursalConResumen } from '../sucursales.repository.js';

export class SucursalResponseDto {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  empresa: ReferenciaConEstadoDto;
  marca: ReferenciaDto;
  // Administradores activos que la tienen en su alcance (RF-00.9); vacio = "Sin administrador"
  administradores: ReferenciaDto[];
  empleadosActivos: number;
  creadoEn: string;
  creadoPor: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;

  static desde(datos: SucursalConResumen): SucursalResponseDto {
    const { sucursal } = datos;
    return {
      id: sucursal.id,
      nombre: sucursal.nombre,
      direccion: sucursal.direccion,
      activo: sucursal.activo,
      empresa: datos.empresa,
      marca: datos.marca,
      administradores: datos.administradores,
      empleadosActivos: datos.empleadosActivos,
      creadoEn: sucursal.creadoEn.toISOString(),
      creadoPor: datos.creadoPorNombre,
      actualizadoEn: sucursal.actualizadoEn.toISOString(),
      actualizadoPor: sucursal.actualizadoPor ? datos.actualizadoPorNombre : null,
    };
  }
}
