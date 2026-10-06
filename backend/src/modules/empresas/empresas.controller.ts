import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../common/constants/roles.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { ActualizarEmpresaDto, CrearEmpresaDto, QueryEmpresasDto } from './dto/empresa.dto.js';
import { EmpresaResponseDto } from './dto/empresa-response.dto.js';
import { EmpresasService } from './empresas.service.js';

@ApiTags('Empresas')
@Roles(ROLES.SUPERUSUARIO)
@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @ApiOperation({ summary: 'Listar empresas', description: 'Con búsqueda por nombre, razón social o prefijo, filtro de estado e indicadores. RF-00.4.' })
  @Get()
  listar(@Query() query: QueryEmpresasDto): Promise<PaginatedResponseDto<EmpresaResponseDto>> {
    return this.empresasService.listar(query);
  }

  @ApiOperation({ summary: 'Crear una empresa', description: 'Con su prefijo de folio, único en la plataforma. RF-00.1, D-30.' })
  @Post()
  crear(@Body() dto: CrearEmpresaDto, @UsuarioActual('id') actorId: string): Promise<EmpresaResponseDto> {
    return this.empresasService.crear(dto, actorId);
  }

  @ApiOperation({ summary: 'Ver una empresa', description: 'Datos, indicadores y quién la creó y modificó (RNF-17).' })
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string): Promise<EmpresaResponseDto> {
    return this.empresasService.obtener(id);
  }

  @ApiOperation({ summary: 'Editar una empresa', description: 'Los certificados ya emitidos conservan su folio aunque cambie el prefijo. RN-08.2.' })
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEmpresaDto,
    @UsuarioActual('id') actorId: string,
  ): Promise<EmpresaResponseDto> {
    return this.empresasService.actualizar(id, dto, actorId);
  }

  @ApiOperation({ summary: 'Activar una empresa' })
  @Post(':id/activar')
  @HttpCode(200)
  activar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<EmpresaResponseDto> {
    return this.empresasService.cambiarEstado(id, true, actorId);
  }

  @ApiOperation({
    summary: 'Desactivar una empresa',
    description: 'Sus empleados no pueden entrar y sus sucursales salen del alcance de los administradores; los datos se conservan. RN-00.3.',
  })
  @Post(':id/desactivar')
  @HttpCode(200)
  desactivar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual('id') actorId: string): Promise<EmpresaResponseDto> {
    return this.empresasService.cambiarEstado(id, false, actorId);
  }
}
