import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { TODOS_LOS_ROLES } from '../../common/constants/roles.js';
import { PermitidoConPasswordTemporal } from '../../common/decorators/permitido-con-password-temporal.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { PermisoNoRequerido } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { ReferenciaDto } from '../../common/dto/referencia.dto.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import type { PerfilResponseDto } from '../usuarios/dto/perfil-response.dto.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthService, type SesionIniciada } from './auth.service.js';
import { CambiarPasswordDto, LoginDto, LoginEmpleadoDto } from './dto/auth.dto.js';
import { COOKIE_SESION } from './jwt.strategy.js';

@ApiTags('Autenticación')
@PermisoNoRequerido()
@Controller('auth')
export class AuthController {
  private readonly cookieBase: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService,
    private readonly empresasService: EmpresasService,
    config: ConfigService,
  ) {
    // El token nunca pasa por JavaScript del navegador (T-05)
    this.cookieBase = {
      httpOnly: true,
      secure: config.get<boolean>('auth.cookieSecure') ?? false,
      sameSite: 'strict',
      path: '/api',
    };
  }

  @ApiOperation({
    summary: 'Iniciar sesión como administrador o superusuario (web)',
    description: 'Con usuario y contraseña. Entrega la sesión en la cookie httpOnly `bonn_sesion` (8 h) y devuelve el perfil con permisos y sucursales. RF-01.1.',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<PerfilResponseDto> {
    const sesion = await this.authService.login(dto.username, dto.password);
    this.guardarCookie(res, sesion);
    return this.usuariosService.obtenerPerfil(sesion.usuarioId);
  }

  @ApiOperation({
    summary: 'Iniciar sesión como empleado (web)',
    description: 'Con empresa, número de empleado y contraseña; el número solo es único dentro de la empresa. Entrega la misma cookie que `/auth/login`. RF-01.1, D-34.',
  })
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login-empleado')
  @HttpCode(200)
  async loginEmpleado(@Body() dto: LoginEmpleadoDto, @Res({ passthrough: true }) res: Response): Promise<PerfilResponseDto> {
    const sesion = await this.authService.loginEmpleado(dto.empresaId, dto.numeroEmpleado, dto.password);
    this.guardarCookie(res, sesion);
    return this.usuariosService.obtenerPerfil(sesion.usuarioId);
  }

  @ApiOperation({
    summary: 'Empresas para el inicio de sesión del empleado',
    description: 'Pública. Solo `id` y `nombre` de las empresas activas, para la lista de la pantalla de acceso. D-34.',
  })
  @Public()
  @Get('empresas')
  empresas(): Promise<ReferenciaDto[]> {
    return this.empresasService.listarParaLogin();
  }

  // Publica: debe poder borrar la cookie aunque el token ya haya expirado
  @ApiOperation({ summary: 'Cerrar sesión', description: 'Borra la cookie; es pública para poder salir aunque el token ya haya expirado. RF-01.6.' })
  @ApiNoContentResponse({ description: 'Cookie borrada.' })
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(COOKIE_SESION, this.cookieBase);
  }

  @ApiOperation({
    summary: 'Sesión actual',
    description: 'Usuario, rol, permisos y sucursales leídos de la base en cada petición. Se permite con contraseña temporal.',
  })
  @Roles(...TODOS_LOS_ROLES)
  @PermitidoConPasswordTemporal()
  @Get('me')
  me(@UsuarioActual('id') id: string): Promise<PerfilResponseDto> {
    return this.usuariosService.obtenerPerfil(id);
  }

  @ApiOperation({
    summary: 'Cambiar la propia contraseña',
    description: 'Exige la actual. Cierra las demás sesiones y entrega una cookie nueva. Se permite con contraseña temporal. RF-01.2, RF-01.3.',
  })
  @Roles(...TODOS_LOS_ROLES)
  @PermitidoConPasswordTemporal()
  @Post('cambiar-password')
  @HttpCode(200)
  async cambiarPassword(
    @Body() dto: CambiarPasswordDto,
    @UsuarioActual() usuario: UsuarioSesion,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PerfilResponseDto> {
    const sesion = await this.authService.cambiarPassword(usuario, dto.passwordActual, dto.passwordNueva);
    this.guardarCookie(res, sesion);
    return this.usuariosService.obtenerPerfil(usuario.id);
  }

  private guardarCookie(res: Response, sesion: SesionIniciada): void {
    res.cookie(COOKIE_SESION, sesion.token, { ...this.cookieBase, expires: sesion.expiraEn });
  }
}
