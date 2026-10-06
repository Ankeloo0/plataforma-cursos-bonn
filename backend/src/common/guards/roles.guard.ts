import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Rol } from '../constants/roles.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { UsuarioSesion } from '../interfaces/usuario-sesion.interface.js';

// Autorizacion por rol, registrada de forma global en AppModule.
//
// 1. Las rutas @Public() pasan sin revisar nada.
// 2. Sin usuario en la peticion -> 401.
// 3. Ruta sin @Roles -> 403: toda ruta debe declarar sus roles para que un olvido no la deje abierta.
// 4. Rol no incluido -> 403.
//
// Es comodidad y orden para los controllers; la pertenencia a la empresa y la propiedad
// del recurso se validan en cada service (technical-spec 4.7 y 4.14).
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const destinos = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, destinos)) {
      return true;
    }

    const usuario = context.switchToHttp().getRequest<Request & { user?: UsuarioSesion }>().user;
    if (!usuario) {
      throw new UnauthorizedException({ message: 'Inicia sesión para continuar.', code: 'SESION_REQUERIDA' });
    }

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, destinos);
    if (!roles || roles.length === 0) {
      this.logger.error(
        `La ruta ${context.getClass().name}.${context.getHandler().name} no declara @Roles ni @Public; se rechaza.`,
      );
      throw new ForbiddenException({ message: 'No tienes permiso para esta acción.', code: 'SIN_PERMISO' });
    }

    if (!roles.includes(usuario.rol)) {
      throw new ForbiddenException({ message: 'No tienes permiso para esta acción.', code: 'SIN_PERMISO' });
    }
    return true;
  }
}
