import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISOS } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ActualizarTemaDto, CrearTemaDto, OrdenDto } from './dto/contenido.dto.js';
import type { TemaResponseDto } from './dto/contenido-response.dto.js';
import { TemasService } from './temas.service.js';

@ApiTags('Temas y materiales')
@Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
@Controller()
export class TemasController {
  constructor(private readonly temasService: TemasService) {}

  @ApiOperation({
    summary: 'Contenido de un curso',
    description: 'Temas en orden con sus materiales, incluidos los ocultos, para el editor (RF-04.3, RF-04.4).',
  })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR, PERMISOS.CURSOS_PUBLICAR, PERMISOS.CURSOS_ASIGNAR)
  @Get('cursos/:cursoId/temas')
  listar(@Param('cursoId', ParseUUIDPipe) cursoId: string, @UsuarioActual() actor: UsuarioSesion): Promise<TemaResponseDto[]> {
    return this.temasService.listar(cursoId, actor);
  }

  @ApiOperation({ summary: 'Agregar un tema', description: 'Se agrega al final. RF-04.3.' })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @Post('cursos/:cursoId/temas')
  crear(
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
    @Body() dto: CrearTemaDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<TemaResponseDto> {
    return this.temasService.crear(cursoId, dto, actor);
  }

  @ApiOperation({
    summary: 'Reordenar los temas',
    description: 'Lista completa de ids en el nuevo orden. Si no coincide con los temas del curso, 409 CURSO_MODIFICADO.',
  })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('cursos/:cursoId/temas/orden')
  reordenar(
    @Param('cursoId', ParseUUIDPipe) cursoId: string,
    @Body() dto: OrdenDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<void> {
    return this.temasService.reordenar(cursoId, dto.ids, actor);
  }

  @ApiOperation({ summary: 'Editar un tema', description: 'Envía el actualizadoEn que leíste (V-13): si cambió, 409 CURSO_MODIFICADO.' })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @Patch('temas/:id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarTemaDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<TemaResponseDto> {
    return this.temasService.actualizar(id, dto, actor);
  }

  @ApiOperation({ summary: 'Ocultar un tema', description: 'Deja de mostrarse y de sumar a la duración (RN-04.5, D-32).' })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @HttpCode(HttpStatus.OK)
  @Post('temas/:id/ocultar')
  ocultar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<TemaResponseDto> {
    return this.temasService.cambiarVisibilidad(id, false, actor);
  }

  @ApiOperation({ summary: 'Mostrar un tema oculto' })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @HttpCode(HttpStatus.OK)
  @Post('temas/:id/mostrar')
  mostrar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<TemaResponseDto> {
    return this.temasService.cambiarVisibilidad(id, true, actor);
  }

  @ApiOperation({ summary: 'Eliminar un tema', description: 'Con sus materiales y sus archivos. RF-04.3.' })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('temas/:id')
  eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<void> {
    return this.temasService.eliminar(id, actor);
  }
}
