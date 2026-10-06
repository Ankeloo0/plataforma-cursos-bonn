import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UsuarioSesion } from '../interfaces/usuario-sesion.interface.js';

// Datos de la sesion (request.user). El autor y el alcance salen de aqui, nunca del cliente (technical-spec 4.14)
export const UsuarioActual = createParamDecorator(
  (campo: keyof UsuarioSesion | undefined, ctx: ExecutionContext) => {
    const usuario = obtenerUsuarioSesion(ctx);
    return campo ? usuario[campo] : usuario;
  },
);

function obtenerUsuarioSesion(ctx: ExecutionContext): UsuarioSesion {
  const request = ctx.switchToHttp().getRequest<Request & {user? : UsuarioSesion}>();
  if (!request.user) {
    // Solo pasa si el decorador se usa en una ruta @Public(): es un error de programacion.
    throw new UnauthorizedException({ message: 'Inicia sesión para continuar.', code: 'SESION_REQUERIDA' });
  }
  return request.user;
}
