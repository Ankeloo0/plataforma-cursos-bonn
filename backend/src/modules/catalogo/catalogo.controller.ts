import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISOS } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import { PermisoNoRequerido, RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { CatalogoService } from './catalogo.service.js';
import { ActualizarAreaDto, ActualizarPuestoDto, CrearAreaDto, CrearPuestoDto, QueryAreasDto, QueryPuestosDto } from './dto/catalogo.dto.js';
import type { AreaResponseDto, PuestoResponseDto } from './dto/catalogo-response.dto.js';

// Recurso de toda la plataforma: no se filtra por alcance, basta el permiso (technical-spec 4.14)
@ApiTags('Catálogo de áreas y puestos')
@Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
@RequierePermiso(PERMISOS.CATALOGO_GESTIONAR)
@Controller()
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  // Lo usan los selectores de empleados y de destinos de cualquier administrador
  @ApiOperation({ summary: 'Listar áreas', description: 'Catálogo completo, sin paginar, con sus puestos y cuántos empleados, sucursales y empresas la usan (RN-02.6).' })
  @PermisoNoRequerido()
  @Get('areas')
  listarAreas(@Query() query: QueryAreasDto): Promise<AreaResponseDto[]> {
    return this.catalogoService.listarAreas(query);
  }

  @ApiOperation({ summary: 'Crear un área', description: 'El nombre es único en la plataforma. RF-02.1, RN-02.1.' })
  @Post('areas')
  crearArea(@Body() dto: CrearAreaDto, @UsuarioActual('id') actorId: string): Promise<AreaResponseDto> {
    return this.catalogoService.crearArea(dto, actorId);
  }

  @ApiOperation({ summary: 'Ver un área' })
  @Get('areas/:id')
  obtenerArea(@Param('id', ParseUUIDPipe) id: string): Promise<AreaResponseDto> {
    return this.catalogoService.obtenerArea(id);
  }

  @ApiOperation({ summary: 'Editar un área', description: 'El cambio se ve en todas las empresas (RN-02.5).' })
  @Patch('areas/:id')
  actualizarArea(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAreaDto,
    @UsuarioActual('id') actorId: string,
  ): Promise<AreaResponseDto> {
    return this.catalogoService.actualizarArea(id, dto, actorId);
  }

  @ApiOperation({ summary: 'Activar un área' })
  @Post('areas/:id/activar')
  @HttpCode(200)
  activarArea(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<AreaResponseDto> {
    return this.catalogoService.cambiarEstadoArea(id, true, actorId);
  }

  @ApiOperation({ summary: 'Desactivar un área', description: 'No se puede con puestos activos (409). RN-02.4.' })
  @Post('areas/:id/desactivar')
  @HttpCode(200)
  desactivarArea(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<AreaResponseDto> {
    return this.catalogoService.cambiarEstadoArea(id, false, actorId);
  }

  @ApiOperation({ summary: 'Listar puestos', description: 'Catálogo completo, sin paginar, con filtro de área y cuántos empleados, sucursales y empresas lo usan.' })
  @PermisoNoRequerido()
  @Get('puestos')
  listarPuestos(@Query() query: QueryPuestosDto): Promise<PuestoResponseDto[]> {
    return this.catalogoService.listarPuestos(query);
  }

  @ApiOperation({ summary: 'Crear un puesto', description: 'En un área activa; el nombre es único dentro del área. RF-02.2, RN-02.1.' })
  @Post('puestos')
  crearPuesto(@Body() dto: CrearPuestoDto, @UsuarioActual('id') actorId: string): Promise<PuestoResponseDto> {
    return this.catalogoService.crearPuesto(dto, actorId);
  }

  @ApiOperation({ summary: 'Ver un puesto' })
  @Get('puestos/:id')
  obtenerPuesto(@Param('id', ParseUUIDPipe) id: string): Promise<PuestoResponseDto> {
    return this.catalogoService.obtenerPuesto(id);
  }

  @ApiOperation({ summary: 'Editar un puesto', description: 'Puede cambiar de área (activa). El cambio se ve en todas las empresas (RN-02.5).' })
  @Patch('puestos/:id')
  actualizarPuesto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPuestoDto,
    @UsuarioActual('id') actorId: string,
  ): Promise<PuestoResponseDto> {
    return this.catalogoService.actualizarPuesto(id, dto, actorId);
  }

  @ApiOperation({ summary: 'Activar un puesto', description: 'Su área debe estar activa.' })
  @Post('puestos/:id/activar')
  @HttpCode(200)
  activarPuesto(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<PuestoResponseDto> {
    return this.catalogoService.cambiarEstadoPuesto(id, true, actorId);
  }

  @ApiOperation({ summary: 'Desactivar un puesto', description: 'No se puede con empleados activos (409). RN-02.3.' })
  @Post('puestos/:id/desactivar')
  @HttpCode(200)
  desactivarPuesto(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<PuestoResponseDto> {
    return this.catalogoService.cambiarEstadoPuesto(id, false, actorId);
  }
}
