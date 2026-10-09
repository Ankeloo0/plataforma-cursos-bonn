import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISOS } from '../../common/constants/permisos.js';
import { ROLES, TODOS_LOS_ROLES } from '../../common/constants/roles.js';
import { PermisoNoRequerido, RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ArchivosService, MATERIAL_TAMANO_MAXIMO_BYTES } from './archivos.service.js';
import type { ArchivoSubidoDto } from './dto/archivo-subido.dto.js';

@ApiTags('Archivos')
@Controller('archivos')
export class ArchivosController {
  constructor(private readonly archivosService: ArchivosService) {}

  @ApiOperation({
    summary: 'Subir el archivo de un material',
    description:
      'Primer paso de un material (RF-04.5): MP4 hasta 500 MB; PDF, JPG, PNG, WebP, DOCX, XLSX o PPTX hasta 50 MB. ' +
      'Se valida el tipo real; las imágenes se guardan en WebP de 1280 px. Devuelve el id que usa POST /temas/:id/materiales.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } } } })
  @Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @Post()
  // En disco (MulterModule de este modulo) y no en memoria: un video de 500 MB no cabe en la memoria de la API
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MATERIAL_TAMANO_MAXIMO_BYTES, files: 1 } }))
  subir(@UploadedFile() archivo: Express.Multer.File | undefined, @UsuarioActual() actor: UsuarioSesion): Promise<ArchivoSubidoDto> {
    return this.archivosService.guardarMaterial(archivo, actor.id);
  }

  @ApiOperation({ summary: 'Cancelar una subida', description: 'Solo quien lo subió y si ningún material lo usa.' })
  @Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
  @RequierePermiso(PERMISOS.CURSOS_GESTIONAR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<void> {
    return this.archivosService.cancelarSubida(id, actor.id);
  }

  @ApiOperation({ summary: 'Descargar un archivo', description: 'Solo si quien lo pide puede verlo; si no, 404. Responde por rangos (videos). RNF-04.' })
  @Roles(...TODOS_LOS_ROLES)
  @PermisoNoRequerido()
  @Get(':id/contenido')
  contenido(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() sesion: UsuarioSesion,
    @Res() res: Response,
  ): Promise<void> {
    return this.archivosService.entregar(id, sesion, res);
  }
}
