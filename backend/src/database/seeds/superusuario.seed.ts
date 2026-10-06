import bcrypt from 'bcrypt';
import type { EntityManager } from 'typeorm';
import { ROLES } from '../../common/constants/roles.js';
import { BCRYPT_COSTO } from '../../common/constants/seguridad.js';

export interface DatosSuperusuario {
  username: string;
  password: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
}

export type ResultadoSuperusuario = 'creado' | 'ya-existia';

// Crea el superusuario de la instalacion (technical-spec 4.13), solo si todavia no existe.
//
// Es idempotente: si ya hay un superusuario no lo toca (tampoco su contrasena), asi que ejecutar
// el seed dos veces no hace nada. Aunque este codigo fallara, la base no permitiria un segundo
// superusuario (indice uq_usuarios_un_superusuario, D-20).
//
// Se crea con `debe_cambiar_password = true`: la contrasena del .env es temporal (RF-01.2).
export async function sembrarSuperusuario(
  manager: EntityManager,
  datos: DatosSuperusuario,
): Promise<ResultadoSuperusuario> {
  const existentes: unknown[] = await manager.query(`SELECT 1 FROM usuarios WHERE rol = $1`, [ROLES.SUPERUSUARIO]);
  if (existentes.length > 0) {
    return 'ya-existia';
  }

  const ocupado: unknown[] = await manager.query(`SELECT 1 FROM usuarios WHERE lower(username) = lower($1)`, [
    datos.username,
  ]);
  if (ocupado.length > 0) {
    throw new Error(`El usuario "${datos.username}" ya existe y no es el superusuario. Usa otro SUPERUSER_USERNAME.`);
  }

  const passwordHash = await bcrypt.hash(datos.password, BCRYPT_COSTO);
  await manager.query(
    `INSERT INTO usuarios (rol, username, password_hash, nombres, apellido_paterno, apellido_materno,
                           debe_cambiar_password, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, true, NULL)`,
    [
      ROLES.SUPERUSUARIO,
      datos.username,
      passwordHash,
      datos.nombres,
      datos.apellidoPaterno,
      datos.apellidoMaterno ?? null,
    ],
  );
  return 'creado';
}
