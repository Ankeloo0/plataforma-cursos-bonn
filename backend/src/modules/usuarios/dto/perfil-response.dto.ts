import type { Permiso } from '../../../common/constants/permisos.js';
import { ReferenciaDto } from '../../../common/dto/referencia.dto.js';
import { urlArchivo } from '../../archivos/archivos.service.js';
import type { SucursalDeAlcance } from '../alcance.repository.js';
import type { UsuarioConSucursal } from '../usuarios.repository.js';

export class SucursalResumenDto extends ReferenciaDto {
  empresa: ReferenciaDto;
  marca: ReferenciaDto;
}

// Lo que necesita el frontend para la sesion (/auth/me) y para "Mi perfil"
export class PerfilResponseDto {
  id: string;
  // null para el empleado
  username: string | null;
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
  // Empleado: su sucursal
  sucursal: SucursalResumenDto | null;

  static desde(
    { usuario, sucursal }: UsuarioConSucursal,
    permisos: Permiso[],
    sucursales: SucursalDeAlcance[],
  ): PerfilResponseDto {
    return {
      id: usuario.id,
      username: usuario.username,
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
