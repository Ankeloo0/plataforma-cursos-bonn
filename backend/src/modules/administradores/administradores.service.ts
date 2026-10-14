import { Injectable } from '@nestjs/common';
import { ROLES } from '../../common/constants/roles.js';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { UsuarioResponseDto } from '../usuarios/dto/usuario-response.dto.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type {
  AccesoAdministradorDto,
  ActualizarAdministradorDto,
  CrearAdministradorDto,
  QueryAdministradoresDto,
} from './dto/administrador.dto.js';
import { AdministradorDetalleDto, AdministradorResumenDto } from './dto/administrador-response.dto.js';

// Solo el superusuario crea administradores y decide sus permisos y sucursales (P-49, D-28)
@Injectable()
export class AdministradoresService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly alcanceService: AlcanceService,
    private readonly empresasService: EmpresasService,
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
  async crear(datos: CrearAdministradorDto, actorId: string): Promise<UsuarioResponseDto> {
    await this.empresasService.exigirActiva(datos.empresaId);
    const administrador = await this.usuariosService.crear(
      {
        rol: ROLES.ADMIN,
        nombres: datos.nombres,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno,
        empresaId: datos.empresaId,
        numeroEmpleado: datos.numeroEmpleado,
        passwordTemporal: datos.passwordTemporal,
      },
      actorId,
    );
    return UsuarioResponseDto.desde(administrador);
  }

  async obtener(id: string): Promise<AdministradorDetalleDto> {
    const administrador = await this.usuariosService.obtenerAdministrador(id);
    const [permisos, sucursales, empresa] = await Promise.all([
      this.alcanceService.permisosDe(id),
      this.alcanceService.sucursalesDe(id),
      administrador.empresaId ? this.empresasService.buscar(administrador.empresaId) : null,
    ]);
    const referencia = empresa ? { id: empresa.id, nombre: empresa.nombre } : null;
    return AdministradorDetalleDto.detalle(administrador, referencia, permisos, sucursales);
  }

  async actualizar(id: string, datos: ActualizarAdministradorDto, actor: UsuarioSesion): Promise<UsuarioResponseDto> {
    const administrador = await this.usuariosService.obtenerAdministrador(id);
    if (datos.empresaId !== undefined && datos.empresaId !== administrador.empresaId) {
      await this.empresasService.exigirActiva(datos.empresaId);
    }
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
