import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { Alcance } from '../../common/interfaces/usuario-sesion.interface.js';
import { Sucursal } from './entities/sucursal.entity.js';

export interface SucursalConResumen {
  sucursal: Sucursal;
  empresa: { id: string; nombre: string; activo: boolean };
  marca: { id: string; nombre: string };
  administradores: { id: string; nombre: string }[];
  empleadosActivos: number;
  creadoPorNombre: string | null;
  actualizadoPorNombre: string | null;
}

@Injectable()
export class SucursalesRepository {
  constructor(@InjectRepository(Sucursal) private readonly repo: Repository<Sucursal>) {}

  async listarDeEmpresa(empresaId: string): Promise<SucursalConResumen[]> {
    const consulta = this.repo.createQueryBuilder('s').where('s.empresa_id = :empresaId', { empresaId });
    const resultado = await this.conResumen(consulta).orderBy('s.activo', 'DESC').addOrderBy('s.nombre', 'ASC').getRawAndEntities();
    return this.combinar(resultado);
  }

  // Selector de sucursales: el superusuario ve todas; el administrador, solo las de su alcance
  async listarEnAlcance(alcance: Alcance): Promise<SucursalConResumen[]> {
    const consulta = this.repo.createQueryBuilder('s');
    if (!alcance.sinLimite) consulta.where('s.id = ANY(:ids)', { ids: alcance.sucursalIds });
    const resultado = await this.conResumen(consulta).orderBy('e.nombre', 'ASC').addOrderBy('s.nombre', 'ASC').getRawAndEntities();
    return this.combinar(resultado);
  }

  async buscarConResumen(id: string): Promise<SucursalConResumen | null> {
    const resultado = await this.conResumen(this.repo.createQueryBuilder('s').where('s.id = :id', { id })).getRawAndEntities();
    return this.combinar(resultado)[0] ?? null;
  }

  buscarPorId(id: string): Promise<Sucursal | null> {
    return this.repo.findOneBy({ id });
  }

  crear(datos: Partial<Sucursal>): Promise<Sucursal> {
    return this.repo.save(this.repo.create(datos));
  }

  guardar(sucursal: Sucursal): Promise<Sucursal> {
    return this.repo.save(sucursal);
  }

  private conResumen(consulta: SelectQueryBuilder<Sucursal>): SelectQueryBuilder<Sucursal> {
    return consulta
      .innerJoin('empresas', 'e', 'e.id = s.empresa_id')
      .innerJoin('marcas', 'm', 'm.id = s.marca_id')
      .leftJoin('usuarios', 'creador', 'creador.id = s.creado_por')
      .leftJoin('usuarios', 'editor', 'editor.id = s.actualizado_por')
      .addSelect(['e.nombre AS empresa_nombre', 'e.activo AS empresa_activo', 'm.nombre AS marca_nombre'])
      .addSelect(
        `(SELECT coalesce(json_agg(json_build_object(
              'id', u.id, 'nombre', concat_ws(' ', u.nombres, u.apellido_paterno, u.apellido_materno))
              ORDER BY u.apellido_paterno, u.nombres), '[]'::json)
            FROM administradores_sucursales a JOIN usuarios u ON u.id = a.usuario_id AND u.activo
           WHERE a.sucursal_id = s.id)`,
        'administradores',
      )
      .addSelect(
        `(SELECT count(*) FROM usuarios u WHERE u.sucursal_id = s.id AND u.rol = 'EMPLEADO' AND u.activo)::int`,
        'empleados_activos',
      )
      .addSelect(`concat_ws(' ', creador.nombres, creador.apellido_paterno, creador.apellido_materno)`, 'creado_por_nombre')
      .addSelect(`concat_ws(' ', editor.nombres, editor.apellido_paterno, editor.apellido_materno)`, 'actualizado_por_nombre');
  }

  private combinar({ entities, raw }: { entities: Sucursal[]; raw: Record<string, unknown>[] }): SucursalConResumen[] {
    return entities.map((sucursal) => {
      const fila = raw.find((r) => r.s_id === sucursal.id)!;
      return {
        sucursal,
        empresa: { id: sucursal.empresaId, nombre: fila.empresa_nombre as string, activo: fila.empresa_activo as boolean },
        marca: { id: sucursal.marcaId, nombre: fila.marca_nombre as string },
        administradores: fila.administradores as { id: string; nombre: string }[],
        empleadosActivos: Number(fila.empleados_activos),
        creadoPorNombre: (fila.creado_por_nombre as string) || null,
        actualizadoPorNombre: (fila.actualizado_por_nombre as string) || null,
      };
    });
  }
}
