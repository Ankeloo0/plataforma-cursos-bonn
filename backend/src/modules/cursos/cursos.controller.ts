import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISOS } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { PORTADA_TAMANO_MAXIMO_BYTES } from '../archivos/archivos.service.js';
import { CursosService } from './cursos.service.js';
import { ActualizarCursoDto, CrearCursoDto, QueryCursosDto } from './dto/curso.dto.js';
import type { CursoResponseDto } from './dto/curso-response.dto.js';

// Publicar, archivar, reactivar y eliminar un borrador llegan en I3.4; temas y materiales, en I3.2
@ApiTags('Cursos')
@Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
@Controller('cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @ApiOperation({
    summary: 'Listar cursos',
    description: 'Búsqueda por título y filtro de estado. El administrador ve los cursos que creó (V-12); cada uno indica si puede editarlo. RF-04.9.',
  })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR, PERMISOS.CURSOS_PUBLICAR, PERMISOS.CURSOS_ASIGNAR)
  @Get()
  listar(@Query() query: QueryCursosDto, @UsuarioActual() actor: UsuarioSesion): Promise<PaginatedResponseDto<CursoResponseDto>> {
    return this.cursosService.listar(query, actor);
  }

  @ApiOperation({ summary: 'Crear un curso', description: 'Nace en borrador. RF-04.1.' })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @Post()
  crear(@Body() dto: CrearCursoDto, @UsuarioActual() actor: UsuarioSesion): Promise<CursoResponseDto> {
    return this.cursosService.crear(dto, actor);
  }

  @ApiOperation({ summary: 'Ver un curso', description: 'Incluye quién lo creó y quién lo modificó. RF-04.10.' })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR, PERMISOS.CURSOS_PUBLICAR, PERMISOS.CURSOS_ASIGNAR)
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<CursoResponseDto> {
    return this.cursosService.obtener(id, actor);
  }

  @ApiOperation({
    summary: 'Editar un curso',
    description: 'Envía el actualizadoEn que leíste: si alguien guardó antes, responde 409 CURSO_MODIFICADO sin guardar (V-13, RN-04.11).',
  })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCursoDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<CursoResponseDto> {
    return this.cursosService.actualizar(id, dto, actor);
  }

  @ApiOperation({
    summary: 'Cambiar la portada',
    description: 'JPG, PNG o WebP de hasta 50 MB. Se guarda en WebP con el lado mayor de 1280 px como máximo (RF-04.6).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { portada: { type: 'string', format: 'binary' } } } })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @Put(':id/portada')
  @UseInterceptors(FileInterceptor('portada', { limits: { fileSize: PORTADA_TAMANO_MAXIMO_BYTES, files: 1 } }))
  cambiarPortada(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<CursoResponseDto> {
    return this.cursosService.cambiarPortada(id, archivo, actor);
  }

  @ApiOperation({ summary: 'Quitar la portada', description: 'Se muestra la portada genérica (RF-04.2).' })
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @Delete(':id/portada')
  quitarPortada(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<CursoResponseDto> {
    return this.cursosService.quitarPortada(id, actor);
  }
}
