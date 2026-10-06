import type { EntityManager } from 'typeorm';
import { ROLES } from '../../common/constants/roles.js';

const NOMBRES_ROLES = {
  [ROLES.SUPERUSUARIO]: 'Superusuario',
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.EMPLEADO]: 'Empleado',
};

// Inserta los tres roles fijos (D-05). Si ya existen, solo actualiza su nombre.
export async function sembrarRoles(manager: EntityManager): Promise<void> {
  for (const [clave, nombre] of Object.entries(NOMBRES_ROLES)) {
    await manager.query(
      `INSERT INTO roles (clave, nombre) VALUES ($1, $2)
       ON CONFLICT (clave) DO UPDATE SET nombre = EXCLUDED.nombre`,
      [clave, nombre],
    );
  }
}
