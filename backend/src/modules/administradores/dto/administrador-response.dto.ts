import type { Permiso } from '../../../common/constants/permisos.js';
import { ReferenciaConEstadoDto, ReferenciaDto } from '../../../common/dto/referencia.dto.js';
import type { SucursalDeAlcance } from '../../usuarios/alcance.repository.js';
import { datosUsuario, UsuarioResponseDto } from '../../usuarios/dto/usuario-response.dto.js';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';
import type { AdministradorConResumen } from '../../usuarios/usuarios.repository.js';

export class AdministradorResumenDto extends UsuarioResponseDto {
  totalPermisos: number;
  totalSucursales: number;

  static resumen({ usuario, permisos, sucursales }: AdministradorConResumen): AdministradorResumenDto {
    return { ...datosUsuario(usuario), totalPermisos: permisos, totalSucursales: sucursales };
  }
}

export class SucursalDeAlcanceDto extends ReferenciaConEstadoDto {
  empresa: ReferenciaConEstadoDto;
  marca: ReferenciaDto;
}

// Ficha y pantalla de permisos de un administrador
export class AdministradorDetalleDto extends UsuarioResponseDto {
  permisos: Permiso[];
  sucursales: SucursalDeAlcanceDto[];

  static detalle(usuario: Usuario, permisos: Permiso[], sucursales: SucursalDeAlcance[]): AdministradorDetalleDto {
    return { ...datosUsuario(usuario), permisos, sucursales };
  }
}
