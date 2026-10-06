import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { AuthService } from './auth.service.js';
import type { JwtPayload } from './jwt-payload.interface.js';

export const COOKIE_SESION = 'bonn_sesion';

// El token viaja solo en la cookie httpOnly: el JavaScript del navegador nunca lo ve (T-05)
function desdeCookie(req: Request): string | null {
  return (req.cookies as Record<string, string> | undefined)?.[COOKIE_SESION] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: desdeCookie,
      secretOrKey: config.getOrThrow<string>('auth.jwtSecret'),
      ignoreExpiration: false,
    });
  }

  // Lo que devuelve queda en request.user. null = 401.
  validate(payload: JwtPayload): Promise<UsuarioSesion | null> {
    return this.authService.validarSesion(payload);
  }
}
