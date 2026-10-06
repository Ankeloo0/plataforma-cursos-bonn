import { Controller, Delete, Get, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TODOS_LOS_ROLES } from '../../common/constants/roles.js';
import { PermisoNoRequerido } from '../../common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { FOTO_TAMANO_MAXIMO_BYTES } from '../archivos/archivos.service.js';
import type { PerfilResponseDto } from './dto/perfil-response.dto.js';
import { UsuariosService } from './usuarios.service.js';

@ApiTags('Mi perfil')
@Roles(...TODOS_LOS_ROLES)
@PermisoNoRequerido()
@Controller('perfil')
export class PerfilController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @ApiOperation({ summary: 'Ver mi perfil', description: 'Datos de solo lectura, permisos y sucursales. RF-01.7.' })
  @Get()
  obtener(@UsuarioActual('id') id: string): Promise<PerfilResponseDto> {
    return this.usuariosService.obtenerPerfil(id);
  }

  @ApiOperation({ summary: 'Cambiar mi foto', description: 'JPG, PNG o WebP de hasta 5 MB; se recorta a 512 × 512. RF-01.7, RN-01.8.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { foto: { type: 'string', format: 'binary' } } } })
  @Put('foto')
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: FOTO_TAMANO_MAXIMO_BYTES, files: 1 } }))
  async cambiarFoto(
    @UsuarioActual('id') id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<PerfilResponseDto> {
    const usuario = await this.usuariosService.obtenerPropio(id);
    await this.usuariosService.cambiarFoto(usuario, archivo, id);
    return this.usuariosService.obtenerPerfil(id);
  }

  @ApiOperation({ summary: 'Quitar mi foto', description: 'Se muestran las iniciales en su lugar. RF-01.9.' })
  @Delete('foto')
  async quitarFoto(@UsuarioActual('id') id: string): Promise<PerfilResponseDto> {
    const usuario = await this.usuariosService.obtenerPropio(id);
    await this.usuariosService.quitarFoto(usuario, id);
    return this.usuariosService.obtenerPerfil(id);
  }
}
