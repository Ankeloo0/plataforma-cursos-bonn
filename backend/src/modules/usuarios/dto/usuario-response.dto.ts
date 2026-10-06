import { urlArchivo } from '../../archivos/archivos.service.js';
import type { Usuario } from '../entities/usuario.entity.js';

export class UsuarioResponseDto {
  id: string;
  rol: string;
  sucursalId: string | null;
  // null para el empleado
  username: string | null;
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

  static desde(usuario: Usuario): UsuarioResponseDto {
    return datosUsuario(usuario);
  }
}

// Objeto plano para que otras respuestas lo extiendan
export function datosUsuario(usuario: Usuario) {
  const bloqueado = usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date() ? usuario.bloqueadoHasta : null;
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
    username: usuario.username,
    nombres: usuario.nombres,
    apellidoPaterno: usuario.apellidoPaterno,
    apellidoMaterno: usuario.apellidoMaterno,
    fotoUrl: urlArchivo(usuario.fotoArchivoId),
    activo: usuario.activo,
    bloqueadoHasta: bloqueado ? bloqueado.toISOString() : null,
    debeCambiarPassword: usuario.debeCambiarPassword,
    ultimoAccesoEn: usuario.ultimoAccesoEn?.toISOString() ?? null,
    creadoEn: usuario.creadoEn.toISOString(),
    actualizadoEn: usuario.actualizadoEn.toISOString(),
  };
}
