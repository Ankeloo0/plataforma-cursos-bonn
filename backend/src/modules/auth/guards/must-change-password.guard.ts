import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMITIDO_CON_PASSWORD_TEMPORAL_KEY } from '../../../common/decorators/permitido-con-password-temporal.decorator.js';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import type { UsuarioSesion } from '../../../common/interfaces/usuario-sesion.interface.js';

// Con contrasena temporal solo se permite cambiarla, consultar la sesion y salir (RF-01.2)
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const destinos = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, destinos)) return true;

    const usuario = context.switchToHttp().getRequest<Request & { user?: UsuarioSesion }>().user;
    if (!usuario?.debeCambiarPassword) return true;
    if (this.reflector.getAllAndOverride<boolean>(PERMITIDO_CON_PASSWORD_TEMPORAL_KEY, destinos)) return true;

    throw new ForbiddenException({
      message: 'Crea tu contraseña para continuar.',
      code: 'DEBE_CAMBIAR_PASSWORD',
    });
  }
}
