import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISOS } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ActualizarMaterialDto, CrearMaterialDto, OrdenDto } from './dto/contenido.dto.js';
import type { MaterialResponseDto } from './dto/contenido-response.dto.js';
import { MaterialesService } from './materiales.service.js';

@ApiTags('Temas y materiales')
@Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
@RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
@Controller()
export class MaterialesController {
  constructor(private readonly materialesService: MaterialesService) {}

  @ApiOperation({
    summary: 'Agregar un material',
    description:
      'Video, PDF, imagen o documento con el archivoId que devolvió POST /archivos, o un enlace con urlExterna. ' +
      'Se agrega al final del tema y recalcula la duración del curso (RF-04.4, D-36).',
  })
  @Post('temas/:temaId/materiales')
  crear(
    @Param('temaId', ParseUUIDPipe) temaId: string,
    @Body() dto: CrearMaterialDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<MaterialResponseDto> {
    return this.materialesService.crear(temaId, dto, actor);
  }

  @ApiOperation({ summary: 'Reordenar los materiales de un tema', description: 'Lista completa de ids del tema en el nuevo orden.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('temas/:temaId/materiales/orden')
  reordenar(
    @Param('temaId', ParseUUIDPipe) temaId: string,
    @Body() dto: OrdenDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<void> {
    return this.materialesService.reordenar(temaId, dto.ids, actor);
  }

  @ApiOperation({
    summary: 'Editar un material',
    description: 'Un archivoId nuevo reemplaza el archivo y borra el anterior. Envía el actualizadoEn que leíste (V-13).',
  })
  @Patch('materiales/:id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMaterialDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<MaterialResponseDto> {
    return this.materialesService.actualizar(id, dto, actor);
  }

  @ApiOperation({ summary: 'Ocultar un material', description: 'Deja de mostrarse y de sumar a la duración (RN-04.5, D-32).' })
  @HttpCode(HttpStatus.OK)
  @Post('materiales/:id/ocultar')
  ocultar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<MaterialResponseDto> {
    return this.materialesService.cambiarVisibilidad(id, false, actor);
  }

  @ApiOperation({ summary: 'Mostrar un material oculto' })
  @HttpCode(HttpStatus.OK)
  @Post('materiales/:id/mostrar')
  mostrar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<MaterialResponseDto> {
    return this.materialesService.cambiarVisibilidad(id, true, actor);
  }

  @ApiOperation({ summary: 'Eliminar un material', description: 'Borra también su archivo.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('materiales/:id')
  eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<void> {
    return this.materialesService.eliminar(id, actor);
  }
}
