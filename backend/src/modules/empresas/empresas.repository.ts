import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { patronBusqueda } from '../../common/utils/busqueda.js';
import type { QueryEmpresasDto } from './dto/empresa.dto.js';
import { Empresa } from './entities/empresa.entity.js';

export interface EmpresaConResumen {
  empresa: Empresa;
  sucursalesActivas: number;
  administradores: number;
  empleadosActivos: number;
  creadoPorNombre: string | null;
  actualizadoPorNombre: string | null;
}

@Injectable()
export class EmpresasRepository {
  constructor(@InjectRepository(Empresa) private readonly repo: Repository<Empresa>) {}

  async listar(filtros: QueryEmpresasDto): Promise<{ empresas: EmpresaConResumen[]; total: number }> {
    const consulta = this.repo.createQueryBuilder('e');
    if (filtros.search) {
      consulta.andWhere('(e.nombre ILIKE :patron OR e.razon_social ILIKE :patron OR e.prefijo_folio ILIKE :patron)', {
        patron: patronBusqueda(filtros.search),
      });
    }
    if (filtros.activo !== undefined) {
      consulta.andWhere('e.activo = :activo', { activo: filtros.activo });
    }

    const total = await consulta.getCount();
    const empresas = await this.conResumen(consulta)
      .orderBy('e.activo', 'DESC')
      .addOrderBy('e.nombre', 'ASC')
      .offset(filtros.offset)
      .limit(filtros.limit)
      .getRawAndEntities();
    return { empresas: this.combinar(empresas), total };
  }

  async buscarConResumen(id: string): Promise<EmpresaConResumen | null> {
    const resultado = await this.conResumen(this.repo.createQueryBuilder('e').where('e.id = :id', { id }))
      .getRawAndEntities();
    return this.combinar(resultado)[0] ?? null;
  }

  listarActivas(): Promise<Empresa[]> {
    return this.repo.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  buscarPorId(id: string): Promise<Empresa | null> {
    return this.repo.findOneBy({ id });
  }

  guardar(empresa: Empresa): Promise<Empresa> {
    return this.repo.save(empresa);
  }

  crear(datos: Partial<Empresa>): Promise<Empresa> {
    return this.repo.save(this.repo.create(datos));
  }

  // Indicadores del listado (RF-00.4). Cursos publicados y cumplimiento llegan con sus tablas (I3 e I7).
  // administradores = administradores activos con al menos una sucursal de la empresa
  private conResumen(consulta: SelectQueryBuilder<Empresa>): SelectQueryBuilder<Empresa> {
    return consulta
      .leftJoin('usuarios', 'creador', 'creador.id = e.creado_por')
      .leftJoin('usuarios', 'editor', 'editor.id = e.actualizado_por')
      .addSelect('(SELECT count(*) FROM sucursales s WHERE s.empresa_id = e.id AND s.activo)::int', 'sucursales_activas')
      .addSelect(
        `(SELECT count(DISTINCT a.usuario_id) FROM administradores_sucursales a
            JOIN sucursales s ON s.id = a.sucursal_id
            JOIN usuarios u ON u.id = a.usuario_id AND u.activo
           WHERE s.empresa_id = e.id)::int`,
        'administradores',
      )
      .addSelect(
        `(SELECT count(*) FROM usuarios u JOIN sucursales s ON s.id = u.sucursal_id
           WHERE s.empresa_id = e.id AND u.rol = 'EMPLEADO' AND u.activo)::int`,
        'empleados_activos',
      )
      .addSelect(`concat_ws(' ', creador.nombres, creador.apellido_paterno, creador.apellido_materno)`, 'creado_por_nombre')
      .addSelect(`concat_ws(' ', editor.nombres, editor.apellido_paterno, editor.apellido_materno)`, 'actualizado_por_nombre');
  }

  private combinar({ entities, raw }: { entities: Empresa[]; raw: Record<string, unknown>[] }): EmpresaConResumen[] {
    return entities.map((empresa) => {
      const fila = raw.find((r) => r.e_id === empresa.id)!;
      return {
        empresa,
        sucursalesActivas: Number(fila.sucursales_activas),
        administradores: Number(fila.administradores),
        empleadosActivos: Number(fila.empleados_activos),
        creadoPorNombre: (fila.creado_por_nombre as string) || null,
        actualizadoPorNombre: (fila.actualizado_por_nombre as string) || null,
      };
    });
  }
}
