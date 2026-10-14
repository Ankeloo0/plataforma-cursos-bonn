import type { Permiso } from '../../../common/constants/permisos.js';
import { ReferenciaDto } from '../../../common/dto/referencia.dto.js';
import { urlArchivo } from '../../archivos/archivos.service.js';
import type { SucursalDeAlcance } from '../alcance.repository.js';
import type { DatosLaborales, UsuarioConSucursal } from '../usuarios.repository.js';

export class SucursalResumenDto extends ReferenciaDto {
  empresa: ReferenciaDto;
  marca: ReferenciaDto;
}

export class DatosLaboralesDto {
  fechaIngreso: string;
  puesto: ReferenciaDto;
  area: ReferenciaDto;
}

// Lo que necesita el frontend para la sesion (/auth/me) y para "Mi perfil"
export class PerfilResponseDto {
  id: string;
  numeroEmpleado: string | null;
  // La empresa de su numero de empleado
  empresa: ReferenciaDto | null;
  rol: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fotoUrl: string | null;
  debeCambiarPassword: boolean;
  ultimoAccesoEn: string | null;
  // Superusuario: todos; administrador: sus casillas; empleado: ninguno
  permisos: Permiso[];
  // Administrador: las sucursales activas en las que opera
  sucursales: SucursalResumenDto[];
  // Empleado: su sucursal y sus datos laborales
  sucursal: SucursalResumenDto | null;
  empleado: DatosLaboralesDto | null;

  static desde(
    { usuario, empresa, sucursal }: UsuarioConSucursal,
    permisos: Permiso[],
    sucursales: SucursalDeAlcance[],
    laborales: DatosLaborales | null = null,
  ): PerfilResponseDto {
    return {
      id: usuario.id,
      numeroEmpleado: usuario.numeroEmpleado,
      empresa: empresa ? { id: empresa.id, nombre: empresa.nombre } : null,
      rol: usuario.rol,
      nombres: usuario.nombres,
      apellidoPaterno: usuario.apellidoPaterno,
      apellidoMaterno: usuario.apellidoMaterno,
      fotoUrl: urlArchivo(usuario.fotoArchivoId),
      debeCambiarPassword: usuario.debeCambiarPassword,
      ultimoAccesoEn: usuario.ultimoAccesoEn?.toISOString() ?? null,
      permisos,
      sucursales: sucursales.filter((s) => s.activo && s.empresa.activo).map(resumen),
      sucursal: sucursal ? resumen(sucursal) : null,
      empleado: laborales,
    };
  }
}

function resumen(s: { id: string; nombre: string; empresa: { id: string; nombre: string }; marca: { id: string; nombre: string } }): SucursalResumenDto {
  return {
    id: s.id,
    nombre: s.nombre,
    empresa: { id: s.empresa.id, nombre: s.empresa.nombre },
    marca: { id: s.marca.id, nombre: s.marca.nombre },
  };
}
