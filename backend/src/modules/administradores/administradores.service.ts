import { Injectable } from '@nestjs/common';
import { ROLES } from '../../common/constants/roles.js';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import type { ActualizarCuentaDto, CrearCuentaDto } from '../usuarios/dto/datos-cuenta.dto.js';
import { UsuarioResponseDto } from '../usuarios/dto/usuario-response.dto.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { AccesoAdministradorDto, QueryAdministradoresDto } from './dto/administrador.dto.js';
import { AdministradorDetalleDto, AdministradorResumenDto } from './dto/administrador-response.dto.js';

// Solo el superusuario crea administradores y decide sus permisos y sucursales (P-49, D-28)
@Injectable()
export class AdministradoresService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly alcanceService: AlcanceService,
  ) {}

  async listar(filtros: QueryAdministradoresDto): Promise<PaginatedResponseDto<AdministradorResumenDto>> {
    const { administradores, total } = await this.usuariosService.listarAdministradores({
      search: filtros.search,
      activo: filtros.activo,
      offset: filtros.offset,
      limit: filtros.limit,
    });
    return PaginatedResponseDto.crear(administradores.map((a) => AdministradorResumenDto.resumen(a)), total, filtros);
  }

  // Nace sin permisos ni sucursales (RF-00.2)
  async crear(datos: CrearCuentaDto, actorId: string): Promise<UsuarioResponseDto> {
    const administrador = await this.usuariosService.crear(
      {
        rol: ROLES.ADMIN,
        nombres: datos.nombres,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno,
        username: datos.username,
        passwordTemporal: datos.passwordTemporal,
      },
      actorId,
    );
    return UsuarioResponseDto.desde(administrador);
  }

  async obtener(id: string): Promise<AdministradorDetalleDto> {
    const administrador = await this.usuariosService.obtenerAdministrador(id);
    const [permisos, sucursales] = await Promise.all([
      this.alcanceService.permisosDe(id),
      this.alcanceService.sucursalesDe(id),
    ]);
    return AdministradorDetalleDto.detalle(administrador, permisos, sucursales);
  }

  async actualizar(id: string, datos: ActualizarCuentaDto, actor: UsuarioSesion): Promise<UsuarioResponseDto> {
    await this.usuariosService.obtenerAdministrador(id);
    return UsuarioResponseDto.desde(await this.usuariosService.actualizarCuenta(id, datos, actor));
  }

  async cambiarFoto(id: string, archivo: Express.Multer.File | undefined, actor: UsuarioSesion): Promise<UsuarioResponseDto> {
    const administrador = await this.usuariosService.obtenerAdministrador(id);
    return UsuarioResponseDto.desde(await this.usuariosService.cambiarFoto(administrador, archivo, actor.id));
  }

  async quitarFoto(id: string, actor: UsuarioSesion): Promise<UsuarioResponseDto> {
    const administrador = await this.usuariosService.obtenerAdministrador(id);
    return UsuarioResponseDto.desde(await this.usuariosService.quitarFoto(administrador, actor.id));
  }

  // Tiene efecto en la siguiente peticion del administrador, sin cerrar su sesion (RN-00.10)
  async reemplazarAcceso(id: string, datos: AccesoAdministradorDto, actorId: string): Promise<AdministradorDetalleDto> {
    await this.usuariosService.obtenerAdministrador(id);
    await this.alcanceService.reemplazarAcceso(id, datos.permisos, datos.sucursalIds, actorId);
    return this.obtener(id);
  }
}
