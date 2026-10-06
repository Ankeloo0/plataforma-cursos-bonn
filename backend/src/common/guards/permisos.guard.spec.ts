import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS, TODOS_LOS_PERMISOS, type Permiso } from '../constants/permisos.js';
import { ROLES, type Rol } from '../constants/roles.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { PERMISO_NO_REQUERIDO_KEY, REQUIERE_PERMISO_KEY } from '../decorators/requiere-permiso.decorator.js';
import type { UsuarioSesion } from '../interfaces/usuario-sesion.interface.js';
import { PermisosGuard } from './permisos.guard.js';

function sesion(rol: Rol, permisos: Permiso[] = []): UsuarioSesion {
  return {
    id: 'u1',
    rol,
    debeCambiarPassword: false,
    permisos,
    alcance: { sinLimite: rol === ROLES.SUPERUSUARIO, sucursalIds: [] },
    sucursalId: null,
  };
}

function contexto(usuario?: UsuarioSesion): ExecutionContext {
  return {
    getHandler: () => function listar() {},
    getClass: () => class MarcasController {},
    switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
  } as unknown as ExecutionContext;
}

function guardCon(metadatos: { publico?: boolean; libre?: boolean; permisos?: Permiso[] }): PermisosGuard {
  const valores: Record<string, unknown> = {
    [IS_PUBLIC_KEY]: metadatos.publico,
    [PERMISO_NO_REQUERIDO_KEY]: metadatos.libre,
    [REQUIERE_PERMISO_KEY]: metadatos.permisos,
  };
  return new PermisosGuard({ getAllAndOverride: (clave: string) => valores[clave] } as unknown as Reflector);
}

describe('PermisosGuard', () => {
  const requiereMarcas = guardCon({ permisos: [PERMISOS.MARCAS_GESTIONAR] });

  it('el superusuario pasa sin tener filas de permisos', () => {
    expect(requiereMarcas.canActivate(contexto(sesion(ROLES.SUPERUSUARIO)))).toBe(true);
  });

  it('un administrador sin el permiso recibe 403', () => {
    expect(() => requiereMarcas.canActivate(contexto(sesion(ROLES.ADMIN, [PERMISOS.REPORTES_VER])))).toThrow(
      ForbiddenException,
    );
  });

  it('basta con uno de los permisos indicados', () => {
    const guard = guardCon({ permisos: [PERMISOS.EMPLEADOS_VER, PERMISOS.EMPLEADOS_GESTIONAR] });
    expect(guard.canActivate(contexto(sesion(ROLES.ADMIN, [PERMISOS.EMPLEADOS_GESTIONAR])))).toBe(true);
  });

  it('rechaza a un administrador en una ruta que olvido declarar sus permisos', () => {
    expect(() => guardCon({}).canActivate(contexto(sesion(ROLES.ADMIN, TODOS_LOS_PERMISOS)))).toThrow(
      ForbiddenException,
    );
  });

  it('deja pasar las rutas marcadas sin permiso y las publicas', () => {
    expect(guardCon({ libre: true }).canActivate(contexto(sesion(ROLES.ADMIN)))).toBe(true);
    expect(guardCon({ publico: true }).canActivate(contexto())).toBe(true);
  });

  it('no revisa permisos de empleados: su acceso lo limita @Roles', () => {
    expect(guardCon({}).canActivate(contexto(sesion(ROLES.EMPLEADO)))).toBe(true);
  });
});
