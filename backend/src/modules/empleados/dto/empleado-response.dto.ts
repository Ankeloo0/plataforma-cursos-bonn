import { ReferenciaConEstadoDto, ReferenciaDto } from '../../../common/dto/referencia.dto.js';
import { urlArchivo } from '../../archivos/archivos.service.js';
import type { EmpleadoDetalle } from '../empleados.repository.js';

// `id` es el del empleado; `usuarioId` se usa en /usuarios/:id (activar, desactivar, restablecer y desbloquear)
export class EmpleadoResponseDto {
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
  puesto: ReferenciaDto;
  area: ReferenciaDto;
  sucursal: ReferenciaConEstadoDto;
  empresa: ReferenciaDto;
  marca: ReferenciaDto;
  // Quien lo dio de alta y quien lo modifico por ultima vez (RF-03.6)
  creadoEn: string;
  creadoPor: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;

  static desde(e: EmpleadoDetalle): EmpleadoResponseDto {
    const bloqueado = e.bloqueadoHasta && e.bloqueadoHasta > new Date() ? e.bloqueadoHasta : null;
    return {
      id: e.id,
      usuarioId: e.usuarioId,
      numeroEmpleado: e.numeroEmpleado,
      fechaIngreso: e.fechaIngreso,
      nombres: e.nombres,
      apellidoPaterno: e.apellidoPaterno,
      apellidoMaterno: e.apellidoMaterno,
      fotoUrl: urlArchivo(e.fotoArchivoId),
      activo: e.activo,
      bloqueadoHasta: bloqueado ? bloqueado.toISOString() : null,
      debeCambiarPassword: e.debeCambiarPassword,
      ultimoAccesoEn: e.ultimoAccesoEn?.toISOString() ?? null,
      puesto: e.puesto,
      area: e.area,
      sucursal: e.sucursal,
      empresa: e.empresa,
      marca: e.marca,
      creadoEn: e.creadoEn.toISOString(),
      creadoPor: e.creadoPor,
      actualizadoEn: e.actualizadoEn.toISOString(),
      actualizadoPor: e.actualizadoPor,
    };
  }
}
