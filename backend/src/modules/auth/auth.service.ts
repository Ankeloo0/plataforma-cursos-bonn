import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { ROLES } from '../../common/constants/roles.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import type { UsuarioConSucursal } from '../usuarios/usuarios.repository.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { JwtPayload } from './jwt-payload.interface.js';

export interface SesionIniciada {
  token: string;
  expiraEn: Date;
  usuarioId: string;
}

// Se compara contra este hash cuando el usuario no existe, para que la respuesta tarde lo mismo
// y no se pueda saber por el tiempo si un usuario existe (RN-01.6)
const HASH_FALSO = '$2b$12$/dDz6F.6KtPc1VXpDr/TJe/22ckPwRoOERXYQQeRTKDGR2forC.f2';

// Ninguno de los dos mensajes dice que dato fallo (RN-01.6)
const CREDENCIALES_INVALIDAS = {
  message: 'Usuario o contraseña incorrectos.',
  code: 'CREDENCIALES_INVALIDAS',
};
const CREDENCIALES_EMPLEADO_INVALIDAS = {
  message: 'Empresa, número de empleado o contraseña incorrectos.',
  code: 'CREDENCIALES_INVALIDAS',
};

type ErrorCredenciales = typeof CREDENCIALES_INVALIDAS;

@Injectable()
export class AuthService {
  private readonly maxIntentos: number;
  private readonly minutosBloqueo: number;

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly alcanceService: AlcanceService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.maxIntentos = config.get<number>('auth.loginMaxIntentos') ?? 5;
    this.minutosBloqueo = config.get<number>('auth.loginBloqueoMinutos') ?? 15;
  }

  // Administrador y superusuario
  async login(username: string, password: string): Promise<SesionIniciada> {
    return this.verificar(await this.usuariosService.buscarParaLogin(username), password, CREDENCIALES_INVALIDAS);
  }

  // Empleado: el numero de empleado solo es unico dentro de su empresa (D-34)
  async loginEmpleado(empresaId: string, numeroEmpleado: string, password: string): Promise<SesionIniciada> {
    const encontrado = await this.usuariosService.buscarEmpleadoParaLogin(empresaId, numeroEmpleado);
    return this.verificar(encontrado, password, CREDENCIALES_EMPLEADO_INVALIDAS);
  }

  async cambiarPassword(sesion: UsuarioSesion, actual: string, nueva: string): Promise<SesionIniciada> {
    const usuario = await this.usuariosService.cambiarPropiaPassword(sesion.id, actual, nueva);
    return this.firmar(usuario);
  }

  // En cada peticion: cuenta activa, token vigente (RF-01.5) y, para el administrador, sus permisos y sucursales
  async validarSesion(payload: JwtPayload): Promise<UsuarioSesion | null> {
    const encontrado = await this.usuariosService.buscarConSucursal(payload.sub);
    if (!encontrado || !puedeEntrar(encontrado) || encontrado.usuario.versionToken !== payload.ver) return null;
    const { usuario } = encontrado;
    const { permisos, alcance } = await this.alcanceService.cargar(usuario);
    return {
      id: usuario.id,
      rol: usuario.rol,
      debeCambiarPassword: usuario.debeCambiarPassword,
      permisos,
      alcance,
      sucursalId: usuario.sucursalId,
    };
  }

  private async verificar(
    encontrado: UsuarioConSucursal | null,
    password: string,
    credencialesInvalidas: ErrorCredenciales,
  ): Promise<SesionIniciada> {
    if (!encontrado) {
      await bcrypt.compare(password, HASH_FALSO);
      throw new UnauthorizedException(credencialesInvalidas);
    }

    const { usuario } = encontrado;
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutos = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        {
          message: `Tu cuenta está bloqueada por intentos fallidos. Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} o pide ayuda a tu administrador.`,
          code: 'CUENTA_BLOQUEADA',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!(await bcrypt.compare(password, usuario.passwordHash))) {
      await this.usuariosService.registrarIntentoFallido(usuario.id, this.maxIntentos, this.minutosBloqueo);
      throw new UnauthorizedException(credencialesInvalidas);
    }

    // Cuenta inactiva, o empleado de una sucursal o empresa inactiva: el mismo mensaje generico (RN-01.2)
    if (!puedeEntrar(encontrado)) {
      throw new UnauthorizedException(credencialesInvalidas);
    }

    await this.usuariosService.registrarAccesoExitoso(usuario.id);
    return this.firmar(usuario);
  }

  private async firmar(usuario: Usuario): Promise<SesionIniciada> {
    const payload: JwtPayload = { sub: usuario.id, ver: usuario.versionToken };
    const token = await this.jwtService.signAsync(payload);
    const { exp } = this.jwtService.decode<{ exp: number }>(token);
    return { token, expiraEn: new Date(exp * 1000), usuarioId: usuario.id };
  }
}

// Desactivar una sucursal o una empresa solo bloquea a sus empleados (RN-00.3, RN-00.8)
function puedeEntrar({ usuario, sucursal }: UsuarioConSucursal): boolean {
  if (!usuario.activo) return false;
  if (usuario.rol !== ROLES.EMPLEADO) return true;
  return sucursal !== null && sucursal.activo && sucursal.empresa.activo;
}
