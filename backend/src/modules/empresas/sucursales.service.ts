import { Injectable, NotFoundException } from '@nestjs/common';
import type { Alcance } from '../../common/interfaces/usuario-sesion.interface.js';
import { MarcasService } from '../marcas/marcas.service.js';
import type { ActualizarSucursalDto, CrearSucursalDto } from './dto/sucursal.dto.js';
import { SucursalResponseDto } from './dto/sucursal-response.dto.js';
import type { Sucursal } from './entities/sucursal.entity.js';
import { EmpresasService } from './empresas.service.js';
import { SucursalesRepository } from './sucursales.repository.js';

const SUCURSAL_NO_ENCONTRADA = { message: 'La sucursal no existe.', code: 'SUCURSAL_NO_ENCONTRADA' };

// Las sucursales las crea y edita solo el superusuario (RF-00.6)
@Injectable()
export class SucursalesService {
  constructor(
    private readonly sucursalesRepository: SucursalesRepository,
    private readonly empresasService: EmpresasService,
    private readonly marcasService: MarcasService,
  ) {}

  async listarDeEmpresa(empresaId: string): Promise<SucursalResponseDto[]> {
    await this.empresasService.buscar(empresaId);
    return (await this.sucursalesRepository.listarDeEmpresa(empresaId)).map((s) => SucursalResponseDto.desde(s));
  }

  async listarEnAlcance(alcance: Alcance): Promise<SucursalResponseDto[]> {
    if (!alcance.sinLimite && alcance.sucursalIds.length === 0) return [];
    return (await this.sucursalesRepository.listarEnAlcance(alcance)).map((s) => SucursalResponseDto.desde(s));
  }

  async obtener(id: string): Promise<SucursalResponseDto> {
    const sucursal = await this.sucursalesRepository.buscarConResumen(id);
    if (!sucursal) throw new NotFoundException(SUCURSAL_NO_ENCONTRADA);
    return SucursalResponseDto.desde(sucursal);
  }

  async crear(empresaId: string, datos: CrearSucursalDto, actorId: string): Promise<SucursalResponseDto> {
    await this.empresasService.buscar(empresaId);
    await this.marcasService.exigirActiva(datos.marcaId);
    const sucursal = await this.sucursalesRepository.crear({
      empresaId,
      marcaId: datos.marcaId,
      nombre: datos.nombre,
      direccion: datos.direccion ?? null,
      creadoPor: actorId,
    });
    return this.obtener(sucursal.id);
  }

  // Cambiar la marca es excepcional: cambia los cursos de marca de sus empleados (RN-00.11)
  async actualizar(id: string, datos: ActualizarSucursalDto, actorId: string): Promise<SucursalResponseDto> {
    const sucursal = await this.buscar(id);
    if (datos.marcaId !== undefined && datos.marcaId !== sucursal.marcaId) {
      await this.marcasService.exigirActiva(datos.marcaId);
      sucursal.marcaId = datos.marcaId;
    }
    if (datos.nombre !== undefined) sucursal.nombre = datos.nombre;
    if (datos.direccion !== undefined) sucursal.direccion = datos.direccion;
    sucursal.actualizadoPor = actorId;
    await this.sucursalesRepository.guardar(sucursal);
    return this.obtener(id);
  }

  // RN-00.8: sus empleados dejan de entrar y sale del alcance de sus administradores; los datos se conservan
  async cambiarEstado(id: string, activo: boolean, actorId: string): Promise<SucursalResponseDto> {
    const sucursal = await this.buscar(id);
    if (sucursal.activo !== activo) {
      sucursal.activo = activo;
      sucursal.actualizadoPor = actorId;
      await this.sucursalesRepository.guardar(sucursal);
    }
    return this.obtener(id);
  }

  private async buscar(id: string): Promise<Sucursal> {
    const sucursal = await this.sucursalesRepository.buscarPorId(id);
    if (!sucursal) throw new NotFoundException(SUCURSAL_NO_ENCONTRADA);
    return sucursal;
  }
}
