import { Building2, House, ShieldCheck, Tag, UserRound, type LucideIcon } from 'lucide-react';
import type { Perfil, Permiso, Rol } from '../features/auth/types/auth.types';
import { puede } from '../utils/permisos';

export interface OpcionMenu {
  etiqueta: string;
  ruta: string;
  icono: LucideIcon;
  roles: Rol[];
  // Para el administrador: basta con uno. Sin permisos = cualquier administrador.
  permisos?: Permiso[];
}

// Menu del panel (functional-spec 2.3). Solo lo que ya existe: cada iteracion agrega sus opciones.
const OPCIONES: OpcionMenu[] = [
  { etiqueta: 'Inicio', ruta: '/panel', icono: House, roles: ['ADMIN'] },
  { etiqueta: 'Empresas', ruta: '/empresas', icono: Building2, roles: ['SUPERUSUARIO'] },
  { etiqueta: 'Marcas', ruta: '/marcas', icono: Tag, roles: ['SUPERUSUARIO', 'ADMIN'], permisos: ['MARCAS_GESTIONAR'] },
  { etiqueta: 'Administradores', ruta: '/administradores', icono: ShieldCheck, roles: ['SUPERUSUARIO'] },
  { etiqueta: 'Mi perfil', ruta: '/perfil', icono: UserRound, roles: ['SUPERUSUARIO', 'ADMIN'] },
];

export function opcionesDeMenu(usuario: Perfil): OpcionMenu[] {
  return OPCIONES.filter(
    (opcion) =>
      opcion.roles.includes(usuario.rol) && (!opcion.permisos || puede(usuario, ...opcion.permisos)),
  );
}

export const NOMBRE_ROL: Record<Rol, string> = {
  SUPERUSUARIO: 'Superusuario',
  ADMIN: 'Administrador',
  EMPLEADO: 'Empleado',
};
