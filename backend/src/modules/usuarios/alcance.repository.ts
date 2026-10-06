import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Permiso } from '../../common/constants/permisos.js';
import { AdministradorSucursal } from './entities/administrador-sucursal.entity.js';
import { UsuarioPermiso } from './entities/usuario-permiso.entity.js';

export interface SucursalDeAlcance {
  id: string;
  nombre: string;
  activo: boolean;
  empresa: { id: string; nombre: string; activo: boolean };
  marca: { id: string; nombre: string };
}

interface FilaSucursal {
  id: string;
  nombre: string;
  activo: boolean;
  empresa_id: string;
  empresa_nombre: string;
  empresa_activo: boolean;
  marca_id: string;
  marca_nombre: string;
}

// Permisos y sucursales de un administrador (database-design 3.8 y 3.9)
@Injectable()
export class AlcanceRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async permisosDe(usuarioId: string): Promise<Permiso[]> {
    const filas = await this.dataSource.getRepository(UsuarioPermiso).find({ where: { usuarioId }, select: { permiso: true } });
    return filas.map((f) => f.permiso);
  }

  // Solo las que puede operar: sucursal activa de una empresa activa
  async sucursalesOperablesDe(usuarioId: string): Promise<string[]> {
    const filas: { id: string }[] = await this.dataSource.query(
      `SELECT s.id FROM administradores_sucursales a
         JOIN sucursales s ON s.id = a.sucursal_id AND s.activo
         JOIN empresas e ON e.id = s.empresa_id AND e.activo
        WHERE a.usuario_id = $1`,
      [usuarioId],
    );
    return filas.map((f) => f.id);
  }

  async sucursalesDe(usuarioId: string): Promise<SucursalDeAlcance[]> {
    const filas: FilaSucursal[] = await this.dataSource.query(
      `SELECT s.id, s.nombre, s.activo,
              e.id AS empresa_id, e.nombre AS empresa_nombre, e.activo AS empresa_activo,
              m.id AS marca_id, m.nombre AS marca_nombre
         FROM administradores_sucursales a
         JOIN sucursales s ON s.id = a.sucursal_id
         JOIN empresas e ON e.id = s.empresa_id
         JOIN marcas m ON m.id = s.marca_id
        WHERE a.usuario_id = $1
        ORDER BY e.nombre, s.nombre`,
      [usuarioId],
    );
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      activo: f.activo,
      empresa: { id: f.empresa_id, nombre: f.empresa_nombre, activo: f.empresa_activo },
      marca: { id: f.marca_id, nombre: f.marca_nombre },
    }));
  }

  async idsDeSucursalesExistentes(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const filas: { id: string }[] = await this.dataSource.query(`SELECT id FROM sucursales WHERE id = ANY($1)`, [ids]);
    return filas.map((f) => f.id);
  }

  // La pantalla envia las dos listas completas. Dentro de una transaccion se borra lo anterior
  // y se inserta lo nuevo: si algo falla, no queda guardada solo una parte.
  async reemplazarAcceso(usuarioId: string, permisos: Permiso[], sucursalIds: string[], actorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UsuarioPermiso, { usuarioId });
      await manager.delete(AdministradorSucursal, { usuarioId });

      if (permisos.length > 0) {
        await manager.insert(
          UsuarioPermiso,
          permisos.map((permiso) => ({ usuarioId, permiso, creadoPor: actorId })),
        );
      }
      if (sucursalIds.length > 0) {
        await manager.insert(
          AdministradorSucursal,
          sucursalIds.map((sucursalId) => ({ usuarioId, sucursalId, creadoPor: actorId })),
        );
      }

      await manager.query(`UPDATE usuarios SET actualizado_por = $2, actualizado_en = now() WHERE id = $1`, [usuarioId, actorId]);
    });
  }
}
