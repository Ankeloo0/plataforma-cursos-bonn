import type { Perfil, Permiso } from '../features/auth/types/auth.types';

// Comodidad para ocultar opciones: la API vuelve a revisar cada permiso (RN-00.1)
export function puede(usuario: Perfil | null, ...permisos: Permiso[]): boolean {
  if (!usuario) return false;
  if (usuario.rol === 'SUPERUSUARIO') return true;
  if (usuario.rol !== 'ADMIN') return false;
  return permisos.some((permiso) => usuario.permisos.includes(permiso));
}
