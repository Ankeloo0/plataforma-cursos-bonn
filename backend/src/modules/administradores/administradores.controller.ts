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
import { CATALOGO_PERMISOS, PLANTILLAS_PERMISOS } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { FOTO_TAMANO_MAXIMO_BYTES } from '../archivos/archivos.service.js';
import { ActualizarCuentaDto, CrearCuentaDto } from '../usuarios/dto/datos-cuenta.dto.js';
import type { UsuarioResponseDto } from '../usuarios/dto/usuario-response.dto.js';
import { AdministradoresService } from './administradores.service.js';
import { AccesoAdministradorDto, QueryAdministradoresDto } from './dto/administrador.dto.js';
import { AdministradorResumenDto, type AdministradorDetalleDto } from './dto/administrador-response.dto.js';
import type { CatalogoPermisosDto } from './dto/catalogo-permisos.dto.js';

// Activar, desactivar, desbloquear y restablecer la contrasena estan en /usuarios
@ApiTags('Administradores y permisos')
@Roles(ROLES.SUPERUSUARIO)
@Controller()
export class AdministradoresController {
  constructor(private readonly administradoresService: AdministradoresService) {}

  @ApiOperation({ summary: 'Catálogo de permisos y plantillas', description: 'Lo que muestra la pantalla de permisos: cada permiso con su grupo, qué permite y dónde aplica. D-28.' })
  @Get('permisos/catalogo')
  catalogo(): CatalogoPermisosDto {
    return { permisos: CATALOGO_PERMISOS, plantillas: PLANTILLAS_PERMISOS };
  }

  @ApiOperation({ summary: 'Listar administradores', description: 'Con búsqueda, estado y cuántos permisos y sucursales tiene cada uno.' })
  @Get('administradores')
  listar(@Query() query: QueryAdministradoresDto): Promise<PaginatedResponseDto<AdministradorResumenDto>> {
    return this.administradoresService.listar(query);
  }

  @ApiOperation({ summary: 'Crear un administrador', description: 'Nace sin permisos ni sucursales, con contraseña temporal. RF-00.2.' })
  @Post('administradores')
  crear(@Body() dto: CrearCuentaDto, @UsuarioActual('id') actorId: string): Promise<UsuarioResponseDto> {
    return this.administradoresService.crear(dto, actorId);
  }

  @ApiOperation({ summary: 'Ver un administrador', description: 'Con sus permisos y sus sucursales (incluidas las inactivas).' })
  @Get('administradores/:id')
  obtener(@Param('id', ParseUUIDPipe) id: string): Promise<AdministradorDetalleDto> {
    return this.administradoresService.obtener(id);
  }

  @ApiOperation({ summary: 'Editar los datos de un administrador', description: 'RF-00.3.' })
  @Patch('administradores/:id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCuentaDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<UsuarioResponseDto> {
    return this.administradoresService.actualizar(id, dto, actor);
  }

  @ApiOperation({
    summary: 'Guardar permisos y sucursales',
    description: 'Listas completas: lo que no venga se quita. Se guarda en una transacción y tiene efecto en la siguiente petición del administrador, sin cerrar su sesión. RF-00.8, RN-00.10.',
  })
  @Put('administradores/:id/acceso')
  reemplazarAcceso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AccesoAdministradorDto,
    @UsuarioActual('id') actorId: string,
  ): Promise<AdministradorDetalleDto> {
    return this.administradoresService.reemplazarAcceso(id, dto, actorId);
  }

  @ApiOperation({ summary: 'Cambiar la foto de un administrador', description: 'RF-01.8.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { foto: { type: 'string', format: 'binary' } } } })
  @Put('administradores/:id/foto')
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: FOTO_TAMANO_MAXIMO_BYTES, files: 1 } }))
  cambiarFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<UsuarioResponseDto> {
    return this.administradoresService.cambiarFoto(id, archivo, actor);
  }

  @ApiOperation({ summary: 'Quitar la foto de un administrador' })
  @Delete('administradores/:id/foto')
  quitarFoto(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<UsuarioResponseDto> {
    return this.administradoresService.quitarFoto(id, actor);
  }
}
