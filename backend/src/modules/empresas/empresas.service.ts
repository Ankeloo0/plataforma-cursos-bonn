import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import type { ReferenciaDto } from '../../common/dto/referencia.dto.js';
import type { ActualizarEmpresaDto, CrearEmpresaDto, QueryEmpresasDto } from './dto/empresa.dto.js';
import { EmpresaResponseDto } from './dto/empresa-response.dto.js';
import type { Empresa } from './entities/empresa.entity.js';
import { EmpresasRepository } from './empresas.repository.js';

export const EMPRESA_NO_ENCONTRADA = { message: 'La empresa no existe.', code: 'EMPRESA_NO_ENCONTRADA' };

@Injectable()
export class EmpresasService {
  constructor(private readonly empresasRepository: EmpresasRepository) {}

  async listar(filtros: QueryEmpresasDto): Promise<PaginatedResponseDto<EmpresaResponseDto>> {
    const { empresas, total } = await this.empresasRepository.listar(filtros);
    return PaginatedResponseDto.crear(empresas.map((e) => EmpresaResponseDto.desde(e)), total, filtros);
  }

  // Lista publica del inicio de sesion del empleado: solo id y nombre (D-34)
  async listarParaLogin(): Promise<ReferenciaDto[]> {
    const empresas = await this.empresasRepository.listarActivas();
    return empresas.map((e) => ({ id: e.id, nombre: e.nombre }));
  }

  async obtener(id: string): Promise<EmpresaResponseDto> {
    const empresa = await this.empresasRepository.buscarConResumen(id);
    if (!empresa) throw new NotFoundException(EMPRESA_NO_ENCONTRADA);
    return EmpresaResponseDto.desde(empresa);
  }

  async crear(datos: CrearEmpresaDto, actorId: string): Promise<EmpresaResponseDto> {
    const empresa = await this.empresasRepository.crear({
      nombre: datos.nombre,
      razonSocial: datos.razonSocial ?? null,
      prefijoFolio: datos.prefijoFolio,
      creadoPor: actorId,
    });
    return this.obtener(empresa.id);
  }

  async actualizar(id: string, datos: ActualizarEmpresaDto, actorId: string): Promise<EmpresaResponseDto> {
    const empresa = await this.buscar(id);
    if (datos.nombre !== undefined) empresa.nombre = datos.nombre;
    if (datos.razonSocial !== undefined) empresa.razonSocial = datos.razonSocial;
    // Los certificados ya emitidos conservan su folio (RN-08.2)
    if (datos.prefijoFolio !== undefined) empresa.prefijoFolio = datos.prefijoFolio;
    empresa.actualizadoPor = actorId;
    await this.empresasRepository.guardar(empresa);
    return this.obtener(id);
  }

  // RN-00.3: con la empresa inactiva sus empleados no entran; las sesiones abiertas se rechazan
  // en la siguiente peticion porque la estrategia JWT la revisa cada vez. Sus sucursales dejan
  // de contar en el alcance de los administradores.
  async cambiarEstado(id: string, activo: boolean, actorId: string): Promise<EmpresaResponseDto> {
    const empresa = await this.buscar(id);
    if (empresa.activo !== activo) {
      empresa.activo = activo;
      empresa.actualizadoPor = actorId;
      await this.empresasRepository.guardar(empresa);
    }
    return this.obtener(id);
  }

  async buscar(id: string): Promise<Empresa> {
    const empresa = await this.empresasRepository.buscarPorId(id);
    if (!empresa) throw new NotFoundException(EMPRESA_NO_ENCONTRADA);
    return empresa;
  }
}
