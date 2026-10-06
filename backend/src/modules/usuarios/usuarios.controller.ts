import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISOS } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { RestablecerPasswordDto } from './dto/datos-cuenta.dto.js';
import { UsuarioResponseDto } from './dto/usuario-response.dto.js';
import { UsuariosService } from './usuarios.service.js';

// El superusuario actua sobre administradores y empleados; el administrador, sobre empleados de sus sucursales
@ApiTags('Cuentas')
@Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @ApiOperation({
    summary: 'Restablecer la contraseña de una cuenta',
    description: 'Nueva contraseña temporal, cierra sus sesiones y la desbloquea. El superusuario, de administradores y empleados; un administrador, de empleados de sus sucursales. RF-01.4, RF-01.5.',
  })
  @RequierePermiso(PERMISOS.EMPLEADOS_RESTABLECER_PASSWORD)
  @Post(':id/restablecer-password')
  @HttpCode(200)
  async restablecerPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestablecerPasswordDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<UsuarioResponseDto> {
    return UsuarioResponseDto.desde(await this.usuariosService.restablecerPassword(id, dto.passwordTemporal, actor));
  }

  @ApiOperation({ summary: 'Activar una cuenta', description: 'Vuelve a permitir el inicio de sesión.' })
  @RequierePermiso(PERMISOS.EMPLEADOS_GESTIONAR)
  @Post(':id/activar')
  @HttpCode(200)
  async activar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<UsuarioResponseDto> {
    return UsuarioResponseDto.desde(await this.usuariosService.activar(id, actor));
  }

  @ApiOperation({ summary: 'Desactivar una cuenta', description: 'Cierra sus sesiones; su historial se conserva. RF-03.4, RN-00.7.' })
  @RequierePermiso(PERMISOS.EMPLEADOS_GESTIONAR)
  @Post(':id/desactivar')
  @HttpCode(200)
  async desactivar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<UsuarioResponseDto> {
    return UsuarioResponseDto.desde(await this.usuariosService.desactivar(id, actor));
  }

  @ApiOperation({ summary: 'Desbloquear una cuenta', description: 'Quita el bloqueo por intentos fallidos antes de que pase el tiempo. P-21.' })
  @RequierePermiso(PERMISOS.EMPLEADOS_RESTABLECER_PASSWORD)
  @Post(':id/desbloquear')
  @HttpCode(200)
  async desbloquear(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<UsuarioResponseDto> {
    return UsuarioResponseDto.desde(await this.usuariosService.desbloquear(id, actor));
  }
}
