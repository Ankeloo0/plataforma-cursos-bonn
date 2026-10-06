import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { patronBusqueda } from '../../common/utils/busqueda.js';
import type { QueryMarcasDto } from './dto/marca.dto.js';
import { Marca } from './entities/marca.entity.js';

export interface MarcaConResumen {
  marca: Marca;
  sucursales: number;
  empresas: number;
  creadoPorNombre: string | null;
  actualizadoPorNombre: string | null;
}

@Injectable()
export class MarcasRepository {
  constructor(@InjectRepository(Marca) private readonly repo: Repository<Marca>) {}

  // Catalogo corto: se lista completo, sin paginar
  async listar(filtros: QueryMarcasDto): Promise<MarcaConResumen[]> {
    const consulta = this.repo.createQueryBuilder('m');
    if (filtros.search) consulta.andWhere('m.nombre ILIKE :patron', { patron: patronBusqueda(filtros.search) });
    if (filtros.activo !== undefined) consulta.andWhere('m.activo = :activo', { activo: filtros.activo });
    const resultado = await this.conResumen(consulta).orderBy('m.activo', 'DESC').addOrderBy('m.nombre', 'ASC').getRawAndEntities();
    return this.combinar(resultado);
  }

  async buscarConResumen(id: string): Promise<MarcaConResumen | null> {
    const resultado = await this.conResumen(this.repo.createQueryBuilder('m').where('m.id = :id', { id })).getRawAndEntities();
    return this.combinar(resultado)[0] ?? null;
  }

  buscarPorId(id: string): Promise<Marca | null> {
    return this.repo.findOneBy({ id });
  }

  crear(datos: Partial<Marca>): Promise<Marca> {
    return this.repo.save(this.repo.create(datos));
  }

  guardar(marca: Marca): Promise<Marca> {
    return this.repo.save(marca);
  }

  private conResumen(consulta: SelectQueryBuilder<Marca>): SelectQueryBuilder<Marca> {
    return consulta
      .leftJoin('usuarios', 'creador', 'creador.id = m.creado_por')
      .leftJoin('usuarios', 'editor', 'editor.id = m.actualizado_por')
      .addSelect('(SELECT count(*) FROM sucursales s WHERE s.marca_id = m.id)::int', 'total_sucursales')
      .addSelect('(SELECT count(DISTINCT s.empresa_id) FROM sucursales s WHERE s.marca_id = m.id)::int', 'total_empresas')
      .addSelect(`concat_ws(' ', creador.nombres, creador.apellido_paterno, creador.apellido_materno)`, 'creado_por_nombre')
      .addSelect(`concat_ws(' ', editor.nombres, editor.apellido_paterno, editor.apellido_materno)`, 'actualizado_por_nombre');
  }

  private combinar({ entities, raw }: { entities: Marca[]; raw: Record<string, unknown>[] }): MarcaConResumen[] {
    return entities.map((marca) => {
      const fila = raw.find((r) => r.m_id === marca.id)!;
      return {
        marca,
        sucursales: Number(fila.total_sucursales),
        empresas: Number(fila.total_empresas),
        creadoPorNombre: (fila.creado_por_nombre as string) || null,
        actualizadoPorNombre: (fila.actualizado_por_nombre as string) || null,
      };
    });
  }
}
