import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CatalogoRepository } from './catalogo.repository.js';
import type {
  ActualizarAreaDto,
  ActualizarPuestoDto,
  CrearAreaDto,
  CrearPuestoDto,
  QueryAreasDto,
  QueryPuestosDto,
} from './dto/catalogo.dto.js';
import { AreaResponseDto, PuestoResponseDto } from './dto/catalogo-response.dto.js';
import type { Area } from './entities/area.entity.js';
import type { Puesto } from './entities/puesto.entity.js';

const AREA_NO_ENCONTRADA = { message: 'El área no existe.', code: 'AREA_NO_ENCONTRADA' };
const PUESTO_NO_ENCONTRADO = { message: 'El puesto no existe.', code: 'PUESTO_NO_ENCONTRADO' };

// Un solo catalogo para toda la plataforma (D-25, RN-02.5). Nada se borra: se desactiva (RN-02.2).
// Invariante: un puesto activo siempre esta en un area activa (RN-02.4 y la regla al activar un puesto).
@Injectable()
export class CatalogoService {
  constructor(private readonly catalogoRepository: CatalogoRepository) {}

  async listarAreas(filtros: QueryAreasDto): Promise<AreaResponseDto[]> {
    return (await this.catalogoRepository.listarAreas(filtros)).map((a) => AreaResponseDto.desde(a));
  }

  async obtenerArea(id: string): Promise<AreaResponseDto> {
    const area = await this.catalogoRepository.buscarAreaConUso(id);
    if (!area) throw new NotFoundException(AREA_NO_ENCONTRADA);
    return AreaResponseDto.desde(area);
  }

  async crearArea(datos: CrearAreaDto, actorId: string): Promise<AreaResponseDto> {
    const area = await this.catalogoRepository.crearArea({
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      creadoPor: actorId,
    });
    return this.obtenerArea(area.id);
  }

  async actualizarArea(id: string, datos: ActualizarAreaDto, actorId: string): Promise<AreaResponseDto> {
    const area = await this.buscarArea(id);
    if (datos.nombre !== undefined) area.nombre = datos.nombre;
    if (datos.descripcion !== undefined) area.descripcion = datos.descripcion;
    area.actualizadoPor = actorId;
    await this.catalogoRepository.guardarArea(area);
    return this.obtenerArea(id);
  }

  // RN-02.4: no se desactiva un area con puestos activos
  async cambiarEstadoArea(id: string, activo: boolean, actorId: string): Promise<AreaResponseDto> {
    const area = await this.buscarArea(id);
    if (area.activo === activo) return this.obtenerArea(id);

    if (!activo && (await this.catalogoRepository.contarPuestosActivos(id)) > 0) {
      throw new ConflictException({
        message: 'El área tiene puestos activos. Desactívalos primero.',
        code: 'AREA_CON_PUESTOS_ACTIVOS',
      });
    }
    area.activo = activo;
    area.actualizadoPor = actorId;
    await this.catalogoRepository.guardarArea(area);
    return this.obtenerArea(id);
  }

  async listarPuestos(filtros: QueryPuestosDto): Promise<PuestoResponseDto[]> {
    return (await this.catalogoRepository.listarPuestos(filtros)).map((p) => PuestoResponseDto.desde(p));
  }

  async obtenerPuesto(id: string): Promise<PuestoResponseDto> {
    const puesto = await this.catalogoRepository.buscarPuestoConUso(id);
    if (!puesto) throw new NotFoundException(PUESTO_NO_ENCONTRADO);
    return PuestoResponseDto.desde(puesto);
  }

  async crearPuesto(datos: CrearPuestoDto, actorId: string): Promise<PuestoResponseDto> {
    await this.exigirAreaActiva(datos.areaId);
    const puesto = await this.catalogoRepository.crearPuesto({
      areaId: datos.areaId,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      creadoPor: actorId,
    });
    return this.obtenerPuesto(puesto.id);
  }

  async actualizarPuesto(id: string, datos: ActualizarPuestoDto, actorId: string): Promise<PuestoResponseDto> {
    const puesto = await this.buscarPuesto(id);
    if (datos.areaId !== undefined && datos.areaId !== puesto.areaId) {
      await this.exigirAreaActiva(datos.areaId);
      puesto.areaId = datos.areaId;
    }
    if (datos.nombre !== undefined) puesto.nombre = datos.nombre;
    if (datos.descripcion !== undefined) puesto.descripcion = datos.descripcion;
    puesto.actualizadoPor = actorId;
    await this.catalogoRepository.guardarPuesto(puesto);
    return this.obtenerPuesto(id);
  }

  // RN-02.3: no se desactiva un puesto con empleados activos. La regla de destinos de cursos llega en I4.
  async cambiarEstadoPuesto(id: string, activo: boolean, actorId: string): Promise<PuestoResponseDto> {
    const puesto = await this.buscarPuesto(id);
    if (puesto.activo === activo) return this.obtenerPuesto(id);

    if (activo) {
      await this.exigirAreaActiva(puesto.areaId);
    } else if ((await this.catalogoRepository.contarEmpleadosActivosDePuesto(id)) > 0) {
      throw new ConflictException({
        message: 'El puesto tiene empleados activos. Cámbialos de puesto antes de desactivarlo.',
        code: 'PUESTO_CON_EMPLEADOS',
      });
    }
    puesto.activo = activo;
    puesto.actualizadoPor = actorId;
    await this.catalogoRepository.guardarPuesto(puesto);
    return this.obtenerPuesto(id);
  }

  // Un empleado nuevo, o que cambia de puesto, solo puede recibir un puesto activo (RN-02.3)
  async exigirPuestoActivo(id: string): Promise<Puesto> {
    const puesto = await this.catalogoRepository.buscarPuesto(id);
    if (!puesto || !puesto.activo) {
      throw new UnprocessableEntityException({
        message: puesto ? 'Ese puesto está desactivado. Elige otro.' : 'El puesto elegido no existe.',
        code: puesto ? 'PUESTO_INACTIVO' : 'PUESTO_NO_ENCONTRADO',
      });
    }
    return puesto;
  }

  private async exigirAreaActiva(id: string): Promise<Area> {
    const area = await this.catalogoRepository.buscarArea(id);
    if (!area || !area.activo) {
      throw new UnprocessableEntityException({
        message: area ? 'Esa área está desactivada. Actívala primero.' : 'El área elegida no existe.',
        code: area ? 'AREA_INACTIVA' : 'AREA_NO_ENCONTRADA',
      });
    }
    return area;
  }

  private async buscarArea(id: string): Promise<Area> {
    const area = await this.catalogoRepository.buscarArea(id);
    if (!area) throw new NotFoundException(AREA_NO_ENCONTRADA);
    return area;
  }

  private async buscarPuesto(id: string): Promise<Puesto> {
    const puesto = await this.catalogoRepository.buscarPuesto(id);
    if (!puesto) throw new NotFoundException(PUESTO_NO_ENCONTRADO);
    return puesto;
  }
}
