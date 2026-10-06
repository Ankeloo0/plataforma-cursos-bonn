// Roles fijos de la plataforma (opcion A, T-17). Coinciden con las claves de la tabla `roles`.
export const ROLES = {
  SUPERUSUARIO: 'SUPERUSUARIO',
  ADMIN: 'ADMIN',
  EMPLEADO: 'EMPLEADO',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];

export const TODOS_LOS_ROLES: Rol[] = [ROLES.SUPERUSUARIO, ROLES.ADMIN, ROLES.EMPLEADO];
