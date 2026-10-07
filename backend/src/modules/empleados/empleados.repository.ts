import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import type { Alcance } from '../../common/interfaces/usuario-sesion.interface.js';
import { patronBusqueda } from '../../common/utils/busqueda.js';
import type { QueryEmpleadosDto } from './dto/empleado.dto.js';
import { Empleado } from './entities/empleado.entity.js';

// Un empleado con su cuenta, su sucursal, su empresa, su marca, su puesto y su area
export interface EmpleadoDetalle {
  id: string;
  usuarioId: string;
  numeroEmpleado: string;
  fechaIngreso: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fotoArchivoId: string | null;
  activo: boolean;
  bloqueadoHasta: Date | null;
  debeCambiarPassword: boolean;
  ultimoAccesoEn: Date | null;
  puesto: { id: string; nombre: string };
  area: { id: string; nombre: string };
  sucursal: { id: string; nombre: string; activo: boolean };
  empresa: { id: string; nombre: string };
  marca: { id: string; nombre: string };
  creadoEn: Date;
  creadoPor: string | null;
  actualizadoEn: Date;
  actualizadoPor: string | null;
}

// Todos los metodos de lectura reciben el alcance: no hay forma de buscar un empleado
// "en cualquier sucursal" sin pasar por el (technical-spec 4.14, punto 3)
@Injectable()
export class EmpleadosRepository {
  constructor(@InjectRepository(Empleado) private readonly repo: Repository<Empleado>) {}

  async listar(filtros: QueryEmpleadosDto, alcance: Alcance): Promise<{ empleados: EmpleadoDetalle[]; total: number }> {
    const consulta = this.conDetalle(alcance);
    if (filtros.search) {
      consulta.andWhere(
        `(concat_ws(' ', u.nombres, u.apellido_paterno, u.apellido_materno) ILIKE :patron OR em.numero_empleado ILIKE :patron)`,
        { patron: patronBusqueda(filtros.search) },
      );
    }
    if (filtros.sucursalId) consulta.andWhere('u.sucursal_id = :sucursalId', { sucursalId: filtros.sucursalId });
    if (filtros.areaId) consulta.andWhere('p.area_id = :areaId', { areaId: filtros.areaId });
    if (filtros.puestoId) consulta.andWhere('em.puesto_id = :puestoId', { puestoId: filtros.puestoId });
    if (filtros.activo !== undefined) consulta.andWhere('u.activo = :activo', { activo: filtros.activo });

    const total = await consulta.getCount();
    const filas = await consulta
      .orderBy('u.activo', 'DESC')
      .addOrderBy('u.apellido_paterno', 'ASC')
      .addOrderBy('u.nombres', 'ASC')
      .offset(filtros.offset)
      .limit(filtros.limit)
      .getRawMany<Record<string, unknown>>();
    return { empleados: filas.map(aDetalle), total };
  }

  async buscarDetalle(id: string, alcance: Alcance): Promise<EmpleadoDetalle | null> {
    const fila = await this.conDetalle(alcance).andWhere('em.id = :id', { id }).getRawOne<Record<string, unknown>>();
    return fila ? aDetalle(fila) : null;
  }

  // Para editar: la fila solo si su sucursal esta en el alcance
  async buscarEnAlcance(id: string, alcance: Alcance): Promise<Empleado | null> {
    const consulta = this.repo
      .createQueryBuilder('em')
      .innerJoin('usuarios', 'u', 'u.id = em.usuario_id')
      .where('em.id = :id', { id });
    if (!alcance.sinLimite) consulta.andWhere('u.sucursal_id = ANY(:ids)', { ids: alcance.sucursalIds });
    return consulta.getOne();
  }

  crear(datos: Partial<Empleado>, manager: EntityManager): Promise<Empleado> {
    return manager.save(manager.create(Empleado, datos));
  }

  guardar(empleado: Empleado, manager: EntityManager): Promise<Empleado> {
    return manager.save(Empleado, empleado);
  }

  private conDetalle(alcance: Alcance): SelectQueryBuilder<Empleado> {
    const consulta = this.repo
      .createQueryBuilder('em')
      .innerJoin('usuarios', 'u', 'u.id = em.usuario_id')
      .innerJoin('sucursales', 's', 's.id = u.sucursal_id')
      .innerJoin('empresas', 'e', 'e.id = s.empresa_id')
      .innerJoin('marcas', 'm', 'm.id = s.marca_id')
      .innerJoin('puestos', 'p', 'p.id = em.puesto_id')
      .innerJoin('areas', 'a', 'a.id = p.area_id')
      .leftJoin('usuarios', 'creador', 'creador.id = em.creado_por')
      .leftJoin('usuarios', 'editor', 'editor.id = em.actualizado_por')
      .select([
        'em.id AS id',
        'em.usuario_id AS usuario_id',
        'em.numero_empleado AS numero_empleado',
        `to_char(em.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso`,
        'em.creado_en AS creado_en',
        'em.actualizado_en AS actualizado_en',
        'em.actualizado_por AS actualizado_por_id',
        'u.nombres AS nombres',
        'u.apellido_paterno AS apellido_paterno',
        'u.apellido_materno AS apellido_materno',
        'u.foto_archivo_id AS foto_archivo_id',
        'u.activo AS activo',
        'u.bloqueado_hasta AS bloqueado_hasta',
        'u.debe_cambiar_password AS debe_cambiar_password',
        'u.ultimo_acceso_en AS ultimo_acceso_en',
        'p.id AS puesto_id',
        'p.nombre AS puesto_nombre',
        'a.id AS area_id',
        'a.nombre AS area_nombre',
        's.id AS sucursal_id',
        's.nombre AS sucursal_nombre',
        's.activo AS sucursal_activo',
        'e.id AS empresa_id',
        'e.nombre AS empresa_nombre',
        'm.id AS marca_id',
        'm.nombre AS marca_nombre',
      ])
      .addSelect(`concat_ws(' ', creador.username, creador.nombres, creador.apellido_paterno, creador.apellido_materno)`, 'creado_por_nombre')
      .addSelect(`concat_ws(' ', editor.username, editor.nombres, editor.apellido_paterno, editor.apellido_materno)`, 'actualizado_por_nombre');
    if (!alcance.sinLimite) consulta.where('u.sucursal_id = ANY(:ids)', { ids: alcance.sucursalIds });
    return consulta;
  }
}

function aDetalle(f: Record<string, unknown>): EmpleadoDetalle {
  return {
    id: f.id as string,
    usuarioId: f.usuario_id as string,
    numeroEmpleado: f.numero_empleado as string,
    fechaIngreso: f.fecha_ingreso as string,
    nombres: f.nombres as string,
    apellidoPaterno: f.apellido_paterno as string,
    apellidoMaterno: f.apellido_materno as string | null,
    fotoArchivoId: f.foto_archivo_id as string | null,
    activo: f.activo as boolean,
    bloqueadoHasta: f.bloqueado_hasta as Date | null,
    debeCambiarPassword: f.debe_cambiar_password as boolean,
    ultimoAccesoEn: f.ultimo_acceso_en as Date | null,
    puesto: { id: f.puesto_id as string, nombre: f.puesto_nombre as string },
    area: { id: f.area_id as string, nombre: f.area_nombre as string },
    sucursal: { id: f.sucursal_id as string, nombre: f.sucursal_nombre as string, activo: f.sucursal_activo as boolean },
    empresa: { id: f.empresa_id as string, nombre: f.empresa_nombre as string },
    marca: { id: f.marca_id as string, nombre: f.marca_nombre as string },
    creadoEn: f.creado_en as Date,
    creadoPor: (f.creado_por_nombre as string) || null,
    actualizadoEn: f.actualizado_en as Date,
    actualizadoPor: f.actualizado_por_id ? (f.actualizado_por_nombre as string) || null : null,
  };
}
