import type { Rol } from '../features/auth/types/auth.types';

const INICIO_POR_ROL: Record<Rol, string> = {
  SUPERUSUARIO: '/empresas',
  ADMIN: '/panel',
  EMPLEADO: '/',
};

export function rutaInicio(rol: Rol): string {
  return INICIO_POR_ROL[rol];
}
