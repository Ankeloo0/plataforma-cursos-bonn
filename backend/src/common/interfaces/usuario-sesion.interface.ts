import type { Permiso } from '../constants/permisos.js';
import type { Rol } from '../constants/roles.js';

// Sucursales en las que opera un administrador (D-28). sinLimite solo para el superusuario.
export interface Alcance {
  sinLimite: boolean;
  sucursalIds: string[];
}

// request.user despues de validar el JWT. Permisos y alcance se leen de la base en cada peticion (T-22).
export interface UsuarioSesion {
  id: string;
  rol: Rol;
  debeCambiarPassword: boolean;
  permisos: Permiso[];
  alcance: Alcance;
  // Solo el empleado tiene sucursal
  sucursalId: string | null;
}
