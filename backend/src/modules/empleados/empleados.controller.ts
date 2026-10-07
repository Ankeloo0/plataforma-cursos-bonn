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
import { FOTO_TAMANO_MAXIMO_BYTES } from '../archivos/archivos.service.js';
import { ActualizarEmpleadoDto, CrearEmpleadoDto, QueryEmpleadosDto } from './dto/empleado.dto.js';
import type { EmpleadoResponseDto } from './dto/empleado-response.dto.js';
import { EmpleadosService } from './empleados.service.js';

// Activar, desactivar, desbloquear y restablecer la contrasena estan en /usuarios/:usuarioId
@ApiTags('Empleados')
@Roles(ROLES.SUPERUSUARIO, ROLES.ADMIN)
@Controller('empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @ApiOperation({
    summary: 'Listar empleados',
    description: 'Solo los de las sucursales del alcance. Búsqueda por nombre o número, filtros de sucursal, área, puesto y estado. RF-03.5.',
  })
  @RequierePermiso(PERMISOS.EMPLEADOS_VER)
  @Get()
  listar(@Query() query: QueryEmpleadosDto, @UsuarioActual() actor: UsuarioSesion): Promise<PaginatedResponseDto<EmpleadoResponseDto>> {
    return this.empleadosService.listar(query, actor);
  }

  @ApiOperation({
    summary: 'Dar de alta un empleado',
    description: 'Crea su cuenta (sin usuario: entra con su empresa y su número) con contraseña temporal. El número no se repite en la empresa (409). RF-03.1, D-34.',
  })
  @RequierePermiso(PERMISOS.EMPLEADOS_GESTIONAR)
  @Post()
  crear(@Body() dto: CrearEmpleadoDto, @UsuarioActual() actor: UsuarioSesion): Promise<EmpleadoResponseDto> {
    return this.empleadosService.crear(dto, actor);
  }

  @ApiOperation({ summary: 'Ver la ficha de un empleado', description: 'Incluye quién lo dio de alta y quién lo modificó. RF-03.6.' })
  @RequierePermiso(PERMISOS.EMPLEADOS_VER)
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<EmpleadoResponseDto> {
    return this.empleadosService.obtener(id, actor);
  }

  @ApiOperation({
    summary: 'Editar un empleado',
    description: 'Datos, número, puesto y sucursal. El traslado es solo a otra sucursal de la misma empresa y de su alcance. RF-03.3.',
  })
  @RequierePermiso(PERMISOS.EMPLEADOS_GESTIONAR)
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEmpleadoDto,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<EmpleadoResponseDto> {
    return this.empleadosService.actualizar(id, dto, actor);
  }

  @ApiOperation({ summary: 'Cambiar la foto de un empleado', description: 'RF-01.8.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { foto: { type: 'string', format: 'binary' } } } })
  @RequierePermiso(PERMISOS.EMPLEADOS_GESTIONAR)
  @Put(':id/foto')
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: FOTO_TAMANO_MAXIMO_BYTES, files: 1 } }))
  cambiarFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @UsuarioActual() actor: UsuarioSesion,
  ): Promise<EmpleadoResponseDto> {
    return this.empleadosService.cambiarFoto(id, archivo, actor);
  }

  @ApiOperation({ summary: 'Quitar la foto de un empleado' })
  @RequierePermiso(PERMISOS.EMPLEADOS_GESTIONAR)
  @Delete(':id/foto')
  quitarFoto(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioSesion): Promise<EmpleadoResponseDto> {
    return this.empleadosService.quitarFoto(id, actor);
  }
}
