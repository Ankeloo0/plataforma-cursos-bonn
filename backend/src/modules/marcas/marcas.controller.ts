import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISOS } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import { PermisoNoRequerido, RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { ActualizarMarcaDto, CrearMarcaDto, QueryMarcasDto } from './dto/marca.dto.js';
import type { MarcaResponseDto } from './dto/marca-response.dto.js';
import { MarcasService } from './marcas.service.js';

@ApiTags('Marcas')
@Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
@RequierePermiso(PERMISOS.MARCAS_GESTIONAR)
@Controller('marcas')
export class MarcasController {
  constructor(private readonly marcasService: MarcasService) {}

  // Lo usan los selectores de sucursal y de destinos de cualquier administrador
  @ApiOperation({ summary: 'Listar marcas', description: 'Catálogo completo, sin paginar, con cuántas sucursales y empresas usan cada marca.' })
  @PermisoNoRequerido()
  @Get()
  listar(@Query() query: QueryMarcasDto): Promise<MarcaResponseDto[]> {
    return this.marcasService.listar(query);
  }

  @ApiOperation({ summary: 'Crear una marca', description: 'RF-00.7.' })
  @Post()
  crear(@Body() dto: CrearMarcaDto, @UsuarioActual('id') actorId: string): Promise<MarcaResponseDto> {
    return this.marcasService.crear(dto, actorId);
  }

  @ApiOperation({ summary: 'Ver una marca', description: 'Incluye las instrucciones del asistente para la marca (D-31).' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string): Promise<MarcaResponseDto> {
    return this.marcasService.obtener(id);
  }

  @ApiOperation({ summary: 'Editar una marca', description: 'El cambio afecta a todas las sucursales que la venden, de cualquier empresa.' })
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMarcaDto,
    @UsuarioActual('id') actorId: string,
  ): Promise<MarcaResponseDto> {
    return this.marcasService.actualizar(id, dto, actorId);
  }

  @ApiOperation({ summary: 'Activar una marca' })
  @Post(':id/activar')
  @HttpCode(200)
  activar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<MarcaResponseDto> {
    return this.marcasService.cambiarEstado(id, true, actorId);
  }

  @ApiOperation({ summary: 'Desactivar una marca', description: 'No bloquea a nadie: solo deja de ofrecerse para sucursales y destinos nuevos. RN-00.12.' })
  @Post(':id/desactivar')
  @HttpCode(200)
  desactivar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<MarcaResponseDto> {
    return this.marcasService.cambiarEstado(id, false, actorId);
  }
}
