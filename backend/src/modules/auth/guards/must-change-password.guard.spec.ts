import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMITIDO_CON_PASSWORD_TEMPORAL_KEY } from '../../../common/decorators/permitido-con-password-temporal.decorator.js';
import { MustChangePasswordGuard } from './must-change-password.guard.js';

function contexto(user: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardCon(metadatos: Record<string, boolean>) {
  const reflector = { getAllAndOverride: (clave: string) => metadatos[clave] } as unknown as Reflector;
  return new MustChangePasswordGuard(reflector);
}

describe('MustChangePasswordGuard', () => {
  const temporal = { id: 'u1', rol: 'ADMIN', debeCambiarPassword: true };

  it('deja pasar a quien ya cambio su contrasena', () => {
    expect(guardCon({}).canActivate(contexto({ ...temporal, debeCambiarPassword: false }))).toBe(true);
  });

  it('con contrasena temporal bloquea las rutas normales', () => {
    expect(() => guardCon({}).canActivate(contexto(temporal))).toThrow(ForbiddenException);
  });

  it('con contrasena temporal permite las rutas marcadas', () => {
    const guard = guardCon({ [PERMITIDO_CON_PASSWORD_TEMPORAL_KEY]: true });
    expect(guard.canActivate(contexto(temporal))).toBe(true);
  });
});
