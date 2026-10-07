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

export interface UsuarioConSucursal {
  usuario: Usuario;
  sucursal: SucursalDeUsuario | null;
}

// Datos laborales del empleado para "Mi perfil" (RF-01.7)
export interface DatosLaborales {
  numeroEmpleado: string;
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
  permisos: number;
  sucursales: number;
}

@Injectable()
export class UsuariosRepository {
  constructor(@InjectRepository(Usuario) private readonly repo: Repository<Usuario>) {}

  buscarPorId(id: string): Promise<Usuario | null> {
    return this.repo.findOneBy({ id });
  }

  // El usuario es unico sin distinguir mayusculas (RN-01.1); los empleados no tienen usuario
  buscarPorUsernameConSucursal(username: string): Promise<UsuarioConSucursal | null> {
    return this.conSucursal(this.repo.createQueryBuilder('u').where('lower(u.username) = lower(:username)', { username }));
  }

  // El numero de empleado es unico dentro de la empresa (RN-01.1). La tabla empleados se crea en I2.
  buscarEmpleadoParaLogin(empresaId: string, numeroEmpleado: string): Promise<UsuarioConSucursal | null> {
    return this.conSucursal(
      this.repo
        .createQueryBuilder('u')
        .innerJoin('empleados', 'emp', 'emp.usuario_id = u.id')
        .where('emp.empresa_id = :empresaId', { empresaId })
        .andWhere('lower(emp.numero_empleado) = lower(:numeroEmpleado)', { numeroEmpleado })
        .andWhere('u.rol = :rol', { rol: ROLES.EMPLEADO }),
    );
  }

  buscarPorIdConSucursal(id: string): Promise<UsuarioConSucursal | null> {
    return this.conSucursal(this.repo.createQueryBuilder('u').where('u.id = :id', { id }));
  }

  async listarAdministradores(filtros: FiltrosAdministradores): Promise<{ administradores: AdministradorConResumen[]; total: number }> {
    const consulta = this.repo.createQueryBuilder('u').where('u.rol = :rol', { rol: ROLES.ADMIN });
    if (filtros.search) {
      consulta.andWhere(
        `(concat_ws(' ', u.nombres, u.apellido_paterno, u.apellido_materno) ILIKE :patron OR u.username ILIKE :patron)`,
        { patron: patronBusqueda(filtros.search) },
      );
    }
    if (filtros.activo !== undefined) consulta.andWhere('u.activo = :activo', { activo: filtros.activo });

    const total = await consulta.getCount();
    const { entities, raw } = await consulta
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
      return { usuario, permisos: Number(fila.total_permisos), sucursales: Number(fila.total_sucursales) };
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
      `SELECT em.numero_empleado, to_char(em.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
              p.id AS puesto_id, p.nombre AS puesto_nombre, a.id AS area_id, a.nombre AS area_nombre
         FROM empleados em
         JOIN puestos p ON p.id = em.puesto_id
         JOIN areas a ON a.id = p.area_id
        WHERE em.usuario_id = $1`,
      [usuarioId],
    );
    if (!fila) return null;
    return {
      numeroEmpleado: fila.numero_empleado,
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
      .leftJoin('empresas', 'e', 'e.id = s.empresa_id')
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
    const sucursal: SucursalDeUsuario | null = usuario.sucursalId
      ? {
          id: usuario.sucursalId,
          nombre: fila.sucursal_nombre,
          activo: fila.sucursal_activo,
          empresa: { id: fila.empresa_id, nombre: fila.empresa_nombre, activo: fila.empresa_activo },
          marca: { id: fila.marca_id, nombre: fila.marca_nombre },
        }
      : null;
    return { usuario, sucursal };
  }
}
