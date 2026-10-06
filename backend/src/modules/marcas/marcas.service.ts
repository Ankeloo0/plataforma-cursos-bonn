import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ActualizarMarcaDto, CrearMarcaDto, QueryMarcasDto } from './dto/marca.dto.js';
import { MarcaResponseDto } from './dto/marca-response.dto.js';
import type { Marca } from './entities/marca.entity.js';
import { MarcasRepository } from './marcas.repository.js';

const MARCA_NO_ENCONTRADA = { message: 'La marca no existe.', code: 'MARCA_NO_ENCONTRADA' };

@Injectable()
export class MarcasService {
  constructor(private readonly marcasRepository: MarcasRepository) {}

  async listar(filtros: QueryMarcasDto): Promise<MarcaResponseDto[]> {
    return (await this.marcasRepository.listar(filtros)).map((m) => MarcaResponseDto.desde(m));
  }

  async obtener(id: string): Promise<MarcaResponseDto> {
    const marca = await this.marcasRepository.buscarConResumen(id);
    if (!marca) throw new NotFoundException(MARCA_NO_ENCONTRADA);
    return MarcaResponseDto.desde(marca);
  }

  async crear(datos: CrearMarcaDto, actorId: string): Promise<MarcaResponseDto> {
    const marca = await this.marcasRepository.crear({
      nombre: datos.nombre,
      instruccionesAsistente: datos.instruccionesAsistente ?? null,
      creadoPor: actorId,
    });
    return this.obtener(marca.id);
  }

  async actualizar(id: string, datos: ActualizarMarcaDto, actorId: string): Promise<MarcaResponseDto> {
    const marca = await this.buscar(id);
    if (datos.nombre !== undefined) marca.nombre = datos.nombre;
    if (datos.instruccionesAsistente !== undefined) marca.instruccionesAsistente = datos.instruccionesAsistente;
    marca.actualizadoPor = actorId;
    await this.marcasRepository.guardar(marca);
    return this.obtener(id);
  }

  // Desactivarla no bloquea a nadie: solo deja de ofrecerse para sucursales nuevas (RN-00.12)
  async cambiarEstado(id: string, activo: boolean, actorId: string): Promise<MarcaResponseDto> {
    const marca = await this.buscar(id);
    if (marca.activo !== activo) {
      marca.activo = activo;
      marca.actualizadoPor = actorId;
      await this.marcasRepository.guardar(marca);
    }
    return this.obtener(id);
  }

  // Una sucursal nueva, o que cambia de marca, solo puede usar una marca activa (V-09)
  async exigirActiva(id: string): Promise<Marca> {
    const marca = await this.marcasRepository.buscarPorId(id);
    if (!marca || !marca.activo) {
      throw new UnprocessableEntityException({
        message: marca ? 'Esa marca está desactivada. Elige otra o actívala primero.' : 'La marca elegida no existe.',
        code: marca ? 'MARCA_INACTIVA' : 'MARCA_NO_ENCONTRADA',
      });
    }
    return marca;
  }

  private async buscar(id: string): Promise<Marca> {
    const marca = await this.marcasRepository.buscarPorId(id);
    if (!marca) throw new NotFoundException(MARCA_NO_ENCONTRADA);
    return marca;
  }
}
