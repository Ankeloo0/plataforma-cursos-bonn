import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { patronBusqueda } from '../../common/utils/busqueda.js';
import type { QueryAreasDto, QueryPuestosDto } from './dto/catalogo.dto.js';
import { Area } from './entities/area.entity.js';
import { Puesto } from './entities/puesto.entity.js';

// Cuantos empleados activos, sucursales y empresas usan un area o un puesto.
// Se muestra antes de renombrar o desactivar, porque el cambio afecta a todas las empresas (RN-02.6).
export interface Uso {
  empleados: number;
  sucursales: number;
  empresas: number;
}

interface Auditoria {
  creadoPorNombre: string | null;
  actualizadoPorNombre: string | null;
}

export interface AreaConUso extends Auditoria {
  area: Area;
  puestos: number;
  puestosActivos: number;
  uso: Uso;
}

export interface PuestoConUso extends Auditoria {
  puesto: Puesto;
  area: { id: string; nombre: string; activo: boolean };
  uso: Uso;
}

// Empleados activos de un puesto, o de los puestos de un area, con sus sucursales y empresas
function subconsultasDeUso(condicionPuesto: string): string[] {
  const desde = `FROM empleados em
     JOIN usuarios u ON u.id = em.usuario_id AND u.activo
     JOIN puestos p ON p.id = em.puesto_id
    WHERE ${condicionPuesto}`;
  return [
    `(SELECT count(*) ${desde})::int`,
    `(SELECT count(DISTINCT u.sucursal_id) ${desde})::int`,
    `(SELECT count(DISTINCT em.empresa_id) ${desde})::int`,
  ];
}

@Injectable()
export class CatalogoRepository {
  private readonly areas: Repository<Area>;
  private readonly puestos: Repository<Puesto>;

  constructor(@InjectDataSource() dataSource: DataSource) {
    this.areas = dataSource.getRepository(Area);
    this.puestos = dataSource.getRepository(Puesto);
  }

  async listarAreas(filtros: QueryAreasDto): Promise<AreaConUso[]> {
    const consulta = this.areas.createQueryBuilder('a');
    if (filtros.search) consulta.andWhere('a.nombre ILIKE :patron', { patron: patronBusqueda(filtros.search) });
    if (filtros.activo !== undefined) consulta.andWhere('a.activo = :activo', { activo: filtros.activo });
    const resultado = await this.areasConUso(consulta).orderBy('a.activo', 'DESC').addOrderBy('a.nombre', 'ASC').getRawAndEntities();
    return this.combinarAreas(resultado);
  }

  async buscarAreaConUso(id: string): Promise<AreaConUso | null> {
    const resultado = await this.areasConUso(this.areas.createQueryBuilder('a').where('a.id = :id', { id })).getRawAndEntities();
    return this.combinarAreas(resultado)[0] ?? null;
  }

  buscarArea(id: string): Promise<Area | null> {
    return this.areas.findOneBy({ id });
  }

  crearArea(datos: Partial<Area>): Promise<Area> {
    return this.areas.save(this.areas.create(datos));
  }

  guardarArea(area: Area): Promise<Area> {
    return this.areas.save(area);
  }

  contarPuestosActivos(areaId: string): Promise<number> {
    return this.puestos.countBy({ areaId, activo: true });
  }

  async listarPuestos(filtros: QueryPuestosDto): Promise<PuestoConUso[]> {
    const consulta = this.puestos.createQueryBuilder('pu');
    if (filtros.areaId) consulta.andWhere('pu.area_id = :areaId', { areaId: filtros.areaId });
    if (filtros.search) consulta.andWhere('pu.nombre ILIKE :patron', { patron: patronBusqueda(filtros.search) });
    if (filtros.activo !== undefined) consulta.andWhere('pu.activo = :activo', { activo: filtros.activo });
    const resultado = await this.puestosConUso(consulta)
      .orderBy('pu.activo', 'DESC')
      .addOrderBy('ar.nombre', 'ASC')
      .addOrderBy('pu.nombre', 'ASC')
      .getRawAndEntities();
    return this.combinarPuestos(resultado);
  }

  async buscarPuestoConUso(id: string): Promise<PuestoConUso | null> {
    const resultado = await this.puestosConUso(this.puestos.createQueryBuilder('pu').where('pu.id = :id', { id })).getRawAndEntities();
    return this.combinarPuestos(resultado)[0] ?? null;
  }

  buscarPuesto(id: string): Promise<Puesto | null> {
    return this.puestos.findOneBy({ id });
  }

  crearPuesto(datos: Partial<Puesto>): Promise<Puesto> {
    return this.puestos.save(this.puestos.create(datos));
  }

  guardarPuesto(puesto: Puesto): Promise<Puesto> {
    return this.puestos.save(puesto);
  }

  async contarEmpleadosActivosDePuesto(puestoId: string): Promise<number> {
    const [fila]: { total: number }[] = await this.puestos.query(
      `SELECT count(*)::int AS total FROM empleados em
         JOIN usuarios u ON u.id = em.usuario_id AND u.activo
        WHERE em.puesto_id = $1`,
      [puestoId],
    );
    return fila.total;
  }

  private areasConUso(consulta: SelectQueryBuilder<Area>): SelectQueryBuilder<Area> {
    const [empleados, sucursales, empresas] = subconsultasDeUso('p.area_id = a.id');
    return this.conAuditoria(consulta, 'a')
      .addSelect('(SELECT count(*) FROM puestos p WHERE p.area_id = a.id)::int', 'total_puestos')
      .addSelect('(SELECT count(*) FROM puestos p WHERE p.area_id = a.id AND p.activo)::int', 'puestos_activos')
      .addSelect(empleados, 'uso_empleados')
      .addSelect(sucursales, 'uso_sucursales')
      .addSelect(empresas, 'uso_empresas');
  }

  private puestosConUso(consulta: SelectQueryBuilder<Puesto>): SelectQueryBuilder<Puesto> {
    const [empleados, sucursales, empresas] = subconsultasDeUso('p.id = pu.id');
    return this.conAuditoria(consulta, 'pu')
      .innerJoin('areas', 'ar', 'ar.id = pu.area_id')
      .addSelect(['ar.nombre AS area_nombre', 'ar.activo AS area_activo'])
      .addSelect(empleados, 'uso_empleados')
      .addSelect(sucursales, 'uso_sucursales')
      .addSelect(empresas, 'uso_empresas');
  }

  private conAuditoria<T extends Area | Puesto>(consulta: SelectQueryBuilder<T>, alias: string): SelectQueryBuilder<T> {
    return consulta
      .leftJoin('usuarios', 'creador', `creador.id = ${alias}.creado_por`)
      .leftJoin('usuarios', 'editor', `editor.id = ${alias}.actualizado_por`)
      .addSelect(`concat_ws(' ', creador.nombres, creador.apellido_paterno, creador.apellido_materno)`, 'creado_por_nombre')
      .addSelect(`concat_ws(' ', editor.nombres, editor.apellido_paterno, editor.apellido_materno)`, 'actualizado_por_nombre');
  }

  private combinarAreas({ entities, raw }: { entities: Area[]; raw: Record<string, unknown>[] }): AreaConUso[] {
    return entities.map((area) => {
      const fila = raw.find((r) => r.a_id === area.id)!;
      return {
        area,
        puestos: Number(fila.total_puestos),
        puestosActivos: Number(fila.puestos_activos),
        uso: usoDe(fila),
        ...auditoriaDe(fila),
      };
    });
  }

  private combinarPuestos({ entities, raw }: { entities: Puesto[]; raw: Record<string, unknown>[] }): PuestoConUso[] {
    return entities.map((puesto) => {
      const fila = raw.find((r) => r.pu_id === puesto.id)!;
      return {
        puesto,
        area: { id: puesto.areaId, nombre: fila.area_nombre as string, activo: fila.area_activo as boolean },
        uso: usoDe(fila),
        ...auditoriaDe(fila),
      };
    });
  }
}

function usoDe(fila: Record<string, unknown>): Uso {
  return {
    empleados: Number(fila.uso_empleados),
    sucursales: Number(fila.uso_sucursales),
    empresas: Number(fila.uso_empresas),
  };
}

function auditoriaDe(fila: Record<string, unknown>): Auditoria {
  return {
    creadoPorNombre: (fila.creado_por_nombre as string) || null,
    actualizadoPorNombre: (fila.actualizado_por_nombre as string) || null,
  };
}
