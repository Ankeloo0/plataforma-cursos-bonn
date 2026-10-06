import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TODOS_LOS_PERMISOS } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { Alcance } from '../../common/interfaces/usuario-sesion.interface.js';
import { ActualizarSucursalDto, CrearSucursalDto } from './dto/sucursal.dto.js';
import type { SucursalResponseDto } from './dto/sucursal-response.dto.js';
import { SucursalesService } from './sucursales.service.js';

@ApiTags('Sucursales')
@Controller()
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  // Selector: cualquier administrador con algun permiso ve sus sucursales
  @ApiOperation({ summary: 'Sucursales que puedo operar', description: 'El superusuario recibe todas; un administrador, solo las de su alcance (RN-00.2).' })
  @Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
  @RequierePermiso(...TODOS_LOS_PERMISOS)
  @Get('sucursales')
  listarEnAlcance(@UsuarioActual('alcance') alcance: Alcance): Promise<SucursalResponseDto[]> {
    return this.sucursalesService.listarEnAlcance(alcance);
  }

  @ApiOperation({ summary: 'Sucursales de una empresa', description: 'Con su marca, dirección y administradores. RF-00.9.' })
  @Roles(ROLES.SUPERUSUARIO)
  @Get('empresas/:empresaId/sucursales')
  listarDeEmpresa(@Param('empresaId', ParseUUIDPipe) empresaId: string): Promise<SucursalResponseDto[]> {
    return this.sucursalesService.listarDeEmpresa(empresaId);
  }

  @ApiOperation({ summary: 'Crear una sucursal', description: 'Vende una sola marca, que debe estar activa. RF-00.6, D-27, V-09.' })
  @Roles(ROLES.SUPERUSUARIO)
  @Post('empresas/:empresaId/sucursales')
  crear(
    @Param('empresaId', ParseUUIDPipe) empresaId: string,
    @Body() dto: CrearSucursalDto,
    @UsuarioActual('id') actorId: string,
  ): Promise<SucursalResponseDto> {
    return this.sucursalesService.crear(empresaId, dto, actorId);
  }

  @ApiOperation({ summary: 'Ver una sucursal' })
  @Roles(ROLES.SUPERUSUARIO)
  @Get('sucursales/:id')
  obtener(@Param('id', ParseUUIDPipe) id: string): Promise<SucursalResponseDto> {
    return this.sucursalesService.obtener(id);
  }

  @ApiOperation({ summary: 'Editar una sucursal', description: 'Cambiar la marca cambia los cursos de marca de sus empleados. RN-00.11.' })
  @Roles(ROLES.SUPERUSUARIO)
  @Patch('sucursales/:id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarSucursalDto,
    @UsuarioActual('id') actorId: string,
  ): Promise<SucursalResponseDto> {
    return this.sucursalesService.actualizar(id, dto, actorId);
  }

  @ApiOperation({ summary: 'Activar una sucursal' })
  @Roles(ROLES.SUPERUSUARIO)
  @Post('sucursales/:id/activar')
  @HttpCode(200)
  activar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<SucursalResponseDto> {
    return this.sucursalesService.cambiarEstado(id, true, actorId);
  }

  @ApiOperation({ summary: 'Desactivar una sucursal', description: 'Sus empleados no pueden entrar y sale del alcance de sus administradores. RN-00.8.' })
  @Roles(ROLES.SUPERUSUARIO)
  @Post('sucursales/:id/desactivar')
  @HttpCode(200)
  desactivar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<SucursalResponseDto> {
    return this.sucursalesService.cambiarEstado(id, false, actorId);
  }
}
