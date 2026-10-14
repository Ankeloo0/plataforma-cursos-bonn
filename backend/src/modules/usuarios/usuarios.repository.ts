import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { ROLES } from '../../common/constants/roles.js';
import { patronBusqueda } from '../../common/utils/busqueda.js';
import { Usuario } from './entities/usuario.entity.js';

// Sucursal de un empleado, con su empresa y su marca
export interface SucursalDeUsuario {
  id: string;
  nombre: string;
  activo: boolean;
  empresa: { id: string; nombre: string; activo: boolean };
  marca: { id: string; nombre: string };
}

export interface EmpresaDeUsuario {
  id: string;
  nombre: string;
  activo: boolean;
}

// empresa es la de su numero de empleado; en el empleado coincide con la de su sucursal
export interface UsuarioConSucursal {
  usuario: Usuario;
  empresa: EmpresaDeUsuario | null;
  sucursal: SucursalDeUsuario | null;
}

// Datos laborales del empleado para "Mi perfil" (RF-01.7)
export interface DatosLaborales {
  fechaIngreso: string;
  puesto: { id: string; nombre: string };
  area: { id: string; nombre: string };
}

export interface FiltrosAdministradores {
  search?: string;
  activo?: boolean;
  offset: number;
  limit: number;
}

export interface AdministradorConResumen {
  usuario: Usuario;
  empresa: { id: string; nombre: string } | null;
  permisos: number;
  sucursales: number;
}

@Injectable()
export class UsuariosRepository {
  constructor(@InjectRepository(Usuario) private readonly repo: Repository<Usuario>) {}

  buscarPorId(id: string): Promise<Usuario | null> {
    return this.repo.findOneBy({ id });
  }

  //cualquier rol; el numero es unico dentro de la empresa y no distingue mayusculas
  buscarParaLogin(empresaId: string, numeroEmpleado: string): Promise<UsuarioConSucursal | null> {
    return this.conSucursal(
      this.repo
        .createQueryBuilder('u')
        .where('u.empresa_id = :empresaId', { empresaId })
        .andWhere('lower(u.numero_empleado) = lower(:numeroEmpleado)', { numeroEmpleado }),
    );
  }

  buscarPorIdConSucursal(id: string): Promise<UsuarioConSucursal | null> {
    return this.conSucursal(this.repo.createQueryBuilder('u').where('u.id = :id', { id }));
  }

  async listarAdministradores(filtros: FiltrosAdministradores): Promise<{ administradores: AdministradorConResumen[]; total: number }> {
    const consulta = this.repo.createQueryBuilder('u').where('u.rol = :rol', { rol: ROLES.ADMIN });
    if (filtros.search) {
      consulta.andWhere(
        `(concat_ws(' ', u.nombres, u.apellido_paterno, u.apellido_materno) ILIKE :patron OR u.numero_empleado ILIKE :patron)`,
        { patron: patronBusqueda(filtros.search) },
      );
    }
    if (filtros.activo !== undefined) consulta.andWhere('u.activo = :activo', { activo: filtros.activo });

    const total = await consulta.getCount();
    const { entities, raw } = await consulta
      .addSelect('(SELECT nombre FROM empresas e WHERE e.id = u.empresa_id)', 'empresa_nombre')
      .addSelect('(SELECT count(*) FROM usuarios_permisos p WHERE p.usuario_id = u.id)::int', 'total_permisos')
      .addSelect('(SELECT count(*) FROM administradores_sucursales a WHERE a.usuario_id = u.id)::int', 'total_sucursales')
      .orderBy('u.activo', 'DESC')
      .addOrderBy('u.apellido_paterno', 'ASC')
      .addOrderBy('u.nombres', 'ASC')
      .offset(filtros.offset)
      .limit(filtros.limit)
      .getRawAndEntities();

    const administradores = entities.map((usuario) => {
      const fila = raw.find((r: Record<string, unknown>) => r.u_id === usuario.id)!;
      const empresa = usuario.empresaId ? { id: usuario.empresaId, nombre: fila.empresa_nombre as string } : null;
      return { usuario, empresa, permisos: Number(fila.total_permisos), sucursales: Number(fila.total_sucursales) };
    });
    return { administradores, total };
  }

  // Con manager, dentro de la transaccion del alta de un empleado
  crear(datos: Partial<Usuario>, manager?: EntityManager): Promise<Usuario> {
    const m = manager ?? this.repo.manager;
    return m.save(m.create(Usuario, datos));
  }

  async datosLaboralesDe(usuarioId: string): Promise<DatosLaborales | null> {
    const [fila]: Record<string, string>[] = await this.repo.query(
      `SELECT to_char(em.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
              p.id AS puesto_id, p.nombre AS puesto_nombre, a.id AS area_id, a.nombre AS area_nombre
         FROM empleados em
         JOIN puestos p ON p.id = em.puesto_id
         JOIN areas a ON a.id = p.area_id
        WHERE em.usuario_id = $1`,
      [usuarioId],
    );
    if (!fila) return null;
    return {
      fechaIngreso: fila.fecha_ingreso,
      puesto: { id: fila.puesto_id, nombre: fila.puesto_nombre },
      area: { id: fila.area_id, nombre: fila.area_nombre },
    };
  }

  guardar(usuario: Usuario, manager?: EntityManager): Promise<Usuario> {
    return (manager ?? this.repo.manager).save(Usuario, usuario);
  }

  // Los contadores del inicio de sesion no son una edicion: no tocan actualizado_en ni actualizado_por.
  // Al llegar al limite se fija el bloqueo y el contador vuelve a cero (P-21).
  async registrarIntentoFallido(id: string, maxIntentos: number, minutosBloqueo: number): Promise<void> {
    await this.repo.query(
      `UPDATE usuarios SET
         intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0 ELSE intentos_fallidos + 1 END,
         bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2
                                THEN now() + make_interval(mins => $3) ELSE bloqueado_hasta END
       WHERE id = $1`,
      [id, maxIntentos, minutosBloqueo],
    );
  }

  async registrarAccesoExitoso(id: string): Promise<void> {
    await this.repo.query(
      `UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso_en = now() WHERE id = $1`,
      [id],
    );
  }

  private async conSucursal(consulta: SelectQueryBuilder<Usuario>): Promise<UsuarioConSucursal | null> {
    const { entities, raw } = await consulta
      .leftJoin('sucursales', 's', 's.id = u.sucursal_id')
      .leftJoin('empresas', 'e', 'e.id = u.empresa_id')
      .leftJoin('marcas', 'm', 'm.id = s.marca_id')
      .addSelect([
        's.nombre AS sucursal_nombre',
        's.activo AS sucursal_activo',
        'e.id AS empresa_id',
        'e.nombre AS empresa_nombre',
        'e.activo AS empresa_activo',
        'm.id AS marca_id',
        'm.nombre AS marca_nombre',
      ])
      .getRawAndEntities();
    if (entities.length === 0) return null;

    const [usuario] = entities;
    const fila = raw[0];
    const empresa: EmpresaDeUsuario | null = usuario.empresaId
      ? { id: fila.empresa_id, nombre: fila.empresa_nombre, activo: fila.empresa_activo }
      : null;
    const sucursal: SucursalDeUsuario | null = usuario.sucursalId
      ? {
          id: usuario.sucursalId,
          nombre: fila.sucursal_nombre,
          activo: fila.sucursal_activo,
          empresa: empresa!,
          marca: { id: fila.marca_id, nombre: fila.marca_nombre },
        }
      : null;
    return { usuario, empresa, sucursal };
  }
}
