import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return esPublica ? true : super.canActivate(context);
  }

  handleRequest<T>(error: unknown, usuario: T | false): T {
    if (error || !usuario) {
      throw new UnauthorizedException({
        message: 'Tu sesión terminó. Inicia sesión de nuevo.',
        code: 'SESION_REQUERIDA',
      });
    }
    return usuario;
  }
}
