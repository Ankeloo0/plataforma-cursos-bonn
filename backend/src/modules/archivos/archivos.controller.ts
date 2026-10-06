import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { TODOS_LOS_ROLES } from '../../common/constants/roles.js';
import { PermisoNoRequerido } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ArchivosService } from './archivos.service.js';

@ApiTags('Archivos')
@Controller('archivos')
export class ArchivosController {
  constructor(private readonly archivosService: ArchivosService) {}

  @ApiOperation({ summary: 'Descargar un archivo', description: 'Solo si quien lo pide puede verlo; si no, 404. RNF-04.' })
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
