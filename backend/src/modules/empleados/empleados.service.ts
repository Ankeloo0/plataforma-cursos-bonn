import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ROLES } from '../../common/constants/roles.js';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { CatalogoService } from '../catalogo/catalogo.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { ActualizarEmpleadoDto, CrearEmpleadoDto, QueryEmpleadosDto } from './dto/empleado.dto.js';
import { EmpleadoResponseDto } from './dto/empleado-response.dto.js';
import { EmpleadosRepository } from './empleados.repository.js';
import type { Empleado } from './entities/empleado.entity.js';

const EMPLEADO_NO_ENCONTRADO = { message: 'El empleado no existe.', code: 'EMPLEADO_NO_ENCONTRADO' };

// El superusuario opera en todas las sucursales; el administrador, solo en las de su alcance.
// Un empleado fuera del alcance responde 404, como si no existiera (technical-spec 4.14).
@Injectable()
export class EmpleadosService {
  constructor(
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly usuariosService: UsuariosService,
    private readonly alcanceService: AlcanceService,
    private readonly catalogoService: CatalogoService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listar(filtros: QueryEmpleadosDto, actor: UsuarioSesion): Promise<PaginatedResponseDto<EmpleadoResponseDto>> {
    if (!actor.alcance.sinLimite && actor.alcance.sucursalIds.length === 0) {
      return PaginatedResponseDto.crear([], 0, filtros);
    }
    const { empleados, total } = await this.empleadosRepository.listar(filtros, actor.alcance);
    return PaginatedResponseDto.crear(empleados.map((e) => EmpleadoResponseDto.desde(e)), total, filtros);
  }

  async obtener(id: string, actor: UsuarioSesion): Promise<EmpleadoResponseDto> {
    const empleado = await this.empleadosRepository.buscarDetalle(id, actor.alcance);
    if (!empleado) throw new NotFoundException(EMPLEADO_NO_ENCONTRADO);
    return EmpleadoResponseDto.desde(empleado);
  }

  // RF-03.1: la cuenta y los datos laborales se guardan juntos o no se guarda nada.
  // Si el numero ya existe en la empresa, el UNIQUE de la base responde 409 (D-34).
  async crear(datos: CrearEmpleadoDto, actor: UsuarioSesion): Promise<EmpleadoResponseDto> {
    const sucursal = await this.alcanceService.exigirSucursal(actor.alcance, datos.sucursalId);
    await this.catalogoService.exigirPuestoActivo(datos.puestoId);

    const empleadoId = await this.dataSource.transaction(async (manager) => {
      const usuario = await this.usuariosService.crear(
        {
          rol: ROLES.EMPLEADO,
          sucursalId: sucursal.id,
          nombres: datos.nombres,
          apellidoPaterno: datos.apellidoPaterno,
          apellidoMaterno: datos.apellidoMaterno,
          passwordTemporal: datos.passwordTemporal,
        },
        actor.id,
        manager,
      );
      const empleado = await this.empleadosRepository.crear(
        {
          usuarioId: usuario.id,
          empresaId: sucursal.empresaId,
          numeroEmpleado: datos.numeroEmpleado,
          puestoId: datos.puestoId,
          fechaIngreso: datos.fechaIngreso,
          creadoPor: actor.id,
        },
        manager,
      );
      return empleado.id;
    });
    return this.obtener(empleadoId, actor);
  }

  // RF-03.3: datos, puesto y sucursal. El traslado es solo dentro de la misma empresa, y la sucursal
  // nueva tambien debe estar en el alcance; asi empleados.empresa_id sigue siendo la de su sucursal (V-03).
  async actualizar(id: string, datos: ActualizarEmpleadoDto, actor: UsuarioSesion): Promise<EmpleadoResponseDto> {
    const empleado = await this.buscarEnAlcance(id, actor);
    const usuario = await this.usuariosService.obtenerGestionable(empleado.usuarioId, actor);

    if (datos.sucursalId !== undefined && datos.sucursalId !== usuario.sucursalId) {
      const nueva = await this.alcanceService.exigirSucursal(actor.alcance, datos.sucursalId);
      if (nueva.empresaId !== empleado.empresaId) {
        throw new UnprocessableEntityException({
          message: 'Solo se puede cambiar a una sucursal de la misma empresa. Entre empresas se da de baja y de alta.',
          code: 'TRASLADO_OTRA_EMPRESA',
        });
      }
      usuario.sucursalId = nueva.id;
    }
    if (datos.puestoId !== undefined && datos.puestoId !== empleado.puestoId) {
      await this.catalogoService.exigirPuestoActivo(datos.puestoId);
      empleado.puestoId = datos.puestoId;
    }
    if (datos.numeroEmpleado !== undefined) empleado.numeroEmpleado = datos.numeroEmpleado;
    if (datos.fechaIngreso !== undefined) empleado.fechaIngreso = datos.fechaIngreso;
    if (datos.nombres !== undefined) usuario.nombres = datos.nombres;
    if (datos.apellidoPaterno !== undefined) usuario.apellidoPaterno = datos.apellidoPaterno;
    if (datos.apellidoMaterno !== undefined) usuario.apellidoMaterno = datos.apellidoMaterno;

    // La ficha muestra la auditoria de empleados: se marca aunque solo cambien datos de la cuenta
    usuario.actualizadoPor = actor.id;
    empleado.actualizadoPor = actor.id;
    await this.dataSource.transaction(async (manager) => {
      await this.usuariosService.guardar(usuario, manager);
      await this.empleadosRepository.guardar(empleado, manager);
    });
    return this.obtener(id, actor);
  }

  async cambiarFoto(id: string, archivo: Express.Multer.File | undefined, actor: UsuarioSesion): Promise<EmpleadoResponseDto> {
    const empleado = await this.buscarEnAlcance(id, actor);
    const usuario = await this.usuariosService.obtenerGestionable(empleado.usuarioId, actor);
    await this.usuariosService.cambiarFoto(usuario, archivo, actor.id);
    return this.obtener(id, actor);
  }

  async quitarFoto(id: string, actor: UsuarioSesion): Promise<EmpleadoResponseDto> {
    const empleado = await this.buscarEnAlcance(id, actor);
    const usuario = await this.usuariosService.obtenerGestionable(empleado.usuarioId, actor);
    await this.usuariosService.quitarFoto(usuario, actor.id);
    return this.obtener(id, actor);
  }

  private async buscarEnAlcance(id: string, actor: UsuarioSesion): Promise<Empleado> {
    const empleado = await this.empleadosRepository.buscarEnAlcance(id, actor.alcance);
    if (!empleado) throw new NotFoundException(EMPLEADO_NO_ENCONTRADO);
    return empleado;
  }
}
