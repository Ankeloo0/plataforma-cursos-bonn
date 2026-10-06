import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES, type Rol } from '../constants/roles.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { UsuarioSesion } from '../interfaces/usuario-sesion.interface.js';
import { RolesGuard } from './roles.guard.js';

function contexto(usuario?: UsuarioSesion): ExecutionContext {
  return {
    getHandler: () => function listar() {},
    getClass: () => class AreasController {},
    switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
  } as unknown as ExecutionContext;
}

function guardCon(metadatos: { publico?: boolean; roles?: Rol[] }): RolesGuard {
  const reflector = {
    getAllAndOverride: (clave: string) => (clave === IS_PUBLIC_KEY ? metadatos.publico : metadatos.roles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

const admin: UsuarioSesion = {
  id: 'u1',
  rol: ROLES.ADMIN,
  debeCambiarPassword: false,
  permisos: [],
  alcance: { sinLimite: false, sucursalIds: ['s1'] },
  sucursalId: null,
};

describe('RolesGuard', () => {
  it('deja pasar una ruta @Public() aunque no haya sesión', () => {
    expect(guardCon({ publico: true }).canActivate(contexto())).toBe(true);
  });

  it('responde 401 si la ruta es privada y no hay sesión', () => {
    expect(() => guardCon({ roles: [ROLES.ADMIN] }).canActivate(contexto())).toThrow(UnauthorizedException);
  });

  it('rechaza una ruta que olvidó declarar @Roles', () => {
    expect(() => guardCon({}).canActivate(contexto(admin))).toThrow(ForbiddenException);
    expect(() => guardCon({ roles: [] }).canActivate(contexto(admin))).toThrow(ForbiddenException);
  });

  it('permite el acceso si el rol está declarado', () => {
    expect(guardCon({ roles: [ROLES.SUPERUSUARIO, ROLES.ADMIN] }).canActivate(contexto(admin))).toBe(true);
  });

  it('responde 403 si el rol no está declarado', () => {
    expect(() => guardCon({ roles: [ROLES.EMPLEADO] }).canActivate(contexto(admin))).toThrow(ForbiddenException);
  });
});
