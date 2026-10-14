import bcrypt from 'bcrypt';
import type { EntityManager } from 'typeorm';
import { ROLES } from '../../common/constants/roles.js';
import { BCRYPT_COSTO } from '../../common/constants/seguridad.js';

export interface DatosSuperusuario {
  empresa: string;
  prefijoFolio: string;
  numeroEmpleado: string;
  password: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
}

export type ResultadoSuperusuario = 'creado' | 'numero-asignado' | 'ya-existia';

// Crea el superusuario de la instalacion (technical-spec 4.13) y la empresa con la que inicia sesion.
//
// Es idempotente: si ya hay un superusuario con numero no lo toca (tampoco su contrasena).
// Si existe pero no tiene numero (instalaciones anteriores a la migracion 6), solo se le asigna.
// Aunque este codigo fallara, la base no permitiria un segundo superusuario (D-20).
//
// Se crea con `debe_cambiar_password = true`: la contrasena del .env es temporal (RF-01.2).
export async function sembrarSuperusuario(
  manager: EntityManager,
  datos: DatosSuperusuario,
): Promise<ResultadoSuperusuario> {
  const [existente]: { id: string; numero_empleado: string | null }[] = await manager.query(
    `SELECT id, numero_empleado FROM usuarios WHERE rol = $1`,
    [ROLES.SUPERUSUARIO],
  );
  if (existente?.numero_empleado) {
    return 'ya-existia';
  }

  //empresas.creado_por es obligatorio: primero el superusuario, despues la empresa y al final su numero
  const id = existente?.id ?? (await insertarSuperusuario(manager, datos));
  const empresaId = await empresaDeInstalacion(manager, datos, id);

  const ocupado: unknown[] = await manager.query(
    `SELECT 1 FROM usuarios WHERE empresa_id = $1 AND lower(numero_empleado) = lower($2)`,
    [empresaId, datos.numeroEmpleado],
  );
  if (ocupado.length > 0) {
    throw new Error(
      `El número "${datos.numeroEmpleado}" ya existe en "${datos.empresa}". Usa otro SUPERUSER_NUMERO_EMPLEADO.`,
    );
  }

  await manager.query(`UPDATE usuarios SET empresa_id = $1, numero_empleado = $2 WHERE id = $3`, [
    empresaId,
    datos.numeroEmpleado,
    id,
  ]);
  return existente ? 'numero-asignado' : 'creado';
}

async function insertarSuperusuario(manager: EntityManager, datos: DatosSuperusuario): Promise<string> {
  const passwordHash = await bcrypt.hash(datos.password, BCRYPT_COSTO);
  const [{ id }]: { id: string }[] = await manager.query(
    `INSERT INTO usuarios (rol, password_hash, nombres, apellido_paterno, apellido_materno,
                           debe_cambiar_password, creado_por)
     VALUES ($1, $2, $3, $4, $5, true, NULL)
     RETURNING id`,
    [ROLES.SUPERUSUARIO, passwordHash, datos.nombres, datos.apellidoPaterno, datos.apellidoMaterno ?? null],
  );
  return id;
}

//si la empresa ya existe (mismo nombre) se usa esa
async function empresaDeInstalacion(manager: EntityManager, datos: DatosSuperusuario, creadoPor: string): Promise<string> {
  const [encontrada]: { id: string }[] = await manager.query(`SELECT id FROM empresas WHERE lower(nombre) = lower($1)`, [
    datos.empresa,
  ]);
  if (encontrada) return encontrada.id;

  const [{ id }]: { id: string }[] = await manager.query(
    `INSERT INTO empresas (nombre, prefijo_folio, creado_por) VALUES ($1, $2, $3) RETURNING id`,
    [datos.empresa, datos.prefijoFolio, creadoPor],
  );
  return id;
}
