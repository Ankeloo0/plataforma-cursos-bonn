import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Permiso } from '../constants/permisos.js';
import { ROLES } from '../constants/roles.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { PERMISO_NO_REQUERIDO_KEY, REQUIERE_PERMISO_KEY } from '../decorators/requiere-permiso.decorator.js';
import type { UsuarioSesion } from '../interfaces/usuario-sesion.interface.js';

const SIN_PERMISO = { message: 'No tienes permiso para esta acción.', code: 'SIN_PERMISO' };

// Corre despues de RolesGuard. Solo revisa a los administradores: el superusuario puede todo
// y el empleado ya quedo limitado por @Roles. Una ruta de administrador sin @RequierePermiso
// ni @PermisoNoRequerido se rechaza, para que un olvido no la deje abierta (technical-spec 4.7).
@Injectable()
export class PermisosGuard implements CanActivate {
  private readonly logger = new Logger(PermisosGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const destinos = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, destinos)) return true;

    const usuario = context.switchToHttp().getRequest<Request & { user?: UsuarioSesion }>().user;
    if (!usuario || usuario.rol !== ROLES.ADMIN) return true;
    if (this.reflector.getAllAndOverride<boolean>(PERMISO_NO_REQUERIDO_KEY, destinos)) return true;

    const requeridos = this.reflector.getAllAndOverride<Permiso[] | undefined>(REQUIERE_PERMISO_KEY, destinos);
    if (!requeridos || requeridos.length === 0) {
      this.logger.error(
        `La ruta ${context.getClass().name}.${context.getHandler().name} admite administradores sin declarar permisos; se rechaza.`,
      );
      throw new ForbiddenException(SIN_PERMISO);
    }
    if (!requeridos.some((permiso) => usuario.permisos.includes(permiso))) {
      throw new ForbiddenException(SIN_PERMISO);
    }
    return true;
  }
}
