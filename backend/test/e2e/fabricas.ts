import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { TODOS_LOS_PERMISOS, type Permiso } from '../../src/common/constants/permisos.js';
import { ROLES, type Rol } from '../../src/common/constants/roles.js';

// Fabricas de datos de prueba con valores unicos, para que cada prueba solo indique lo que le importa.
// Usan SQL directo para no depender de las reglas de los services que se estan probando.

// Hash bcrypt (costo 4, solo para pruebas) de PASSWORD_PRUEBA
export const PASSWORD_PRUEBA = 'Prueba123';
const HASH_PRUEBA = '$2b$04$xAzTfyG5dWFd/3qbSGKCTuPpCoMJkKJDry..l8dONVkkXtgy6Fx4i';

export interface UsuarioCreado {
  id: string;
  // null para el empleado (D-34)
  username: string | null;
  rol: Rol;
  sucursalId: string | null;
}

interface Registro {
  id: string;
  nombre: string;
}

function sufijo(): string {
  return randomUUID().slice(0, 8);
}

const COLUMNAS_USUARIO = `id, username, rol, sucursal_id AS "sucursalId"`;

export async function obtenerSuperusuario(ds: DataSource): Promise<UsuarioCreado> {
  const [existente] = await ds.query(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE rol = $1`, [ROLES.SUPERUSUARIO]);
  if (existente) return existente;

  const [creado] = await ds.query(
    `INSERT INTO usuarios (rol, username, password_hash, nombres, apellido_paterno, debe_cambiar_password)
     VALUES ($1, 'superusuario', $2, 'Superusuario', 'Pruebas', false)
     RETURNING ${COLUMNAS_USUARIO}`,
    [ROLES.SUPERUSUARIO, HASH_PRUEBA],
  );
  return creado;
}

export async function crearEmpresa(
  ds: DataSource,
  datos: { nombre?: string; prefijoFolio?: string; activo?: boolean } = {},
): Promise<Registro & { prefijoFolio: string }> {
  const superusuario = await obtenerSuperusuario(ds);
  const [empresa] = await ds.query(
    `INSERT INTO empresas (nombre, prefijo_folio, activo, creado_por) VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, prefijo_folio AS "prefijoFolio"`,
    [
      datos.nombre ?? `Empresa ${sufijo()}`,
      datos.prefijoFolio ?? `P${sufijo().slice(0, 5).toUpperCase()}`,
      datos.activo ?? true,
      superusuario.id,
    ],
  );
  return empresa;
}

export async function crearMarca(ds: DataSource, datos: { nombre?: string; activo?: boolean } = {}): Promise<Registro> {
  const superusuario = await obtenerSuperusuario(ds);
  const [marca] = await ds.query(
    `INSERT INTO marcas (nombre, activo, creado_por) VALUES ($1, $2, $3) RETURNING id, nombre`,
    [datos.nombre ?? `Marca ${sufijo()}`, datos.activo ?? true, superusuario.id],
  );
  return marca;
}

export async function crearSucursal(
  ds: DataSource,
  datos: { empresaId: string; marcaId?: string; nombre?: string; activo?: boolean },
): Promise<Registro & { empresaId: string; marcaId: string }> {
  const superusuario = await obtenerSuperusuario(ds);
  const marcaId = datos.marcaId ?? (await crearMarca(ds)).id;
  const [sucursal] = await ds.query(
    `INSERT INTO sucursales (empresa_id, marca_id, nombre, activo, creado_por) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, empresa_id AS "empresaId", marca_id AS "marcaId"`,
    [datos.empresaId, marcaId, datos.nombre ?? `Sucursal ${sufijo()}`, datos.activo ?? true, superusuario.id],
  );
  return sucursal;
}

async function insertarUsuario(
  ds: DataSource,
  datos: { rol: Exclude<Rol, 'SUPERUSUARIO'>; sucursalId: string | null; username?: string; debeCambiarPassword?: boolean },
): Promise<UsuarioCreado> {
  const superusuario = await obtenerSuperusuario(ds);
  const [usuario] = await ds.query(
    `INSERT INTO usuarios (rol, sucursal_id, username, password_hash, nombres, apellido_paterno,
                           debe_cambiar_password, creado_por)
     VALUES ($1, $2, $3, $4, 'Usuario', 'Pruebas', $5, $6)
     RETURNING ${COLUMNAS_USUARIO}`,
    [
      datos.rol,
      datos.sucursalId,
      datos.rol === ROLES.EMPLEADO ? null : (datos.username ?? `usuario_${sufijo()}`),
      HASH_PRUEBA,
      datos.debeCambiarPassword ?? false,
      superusuario.id,
    ],
  );
  return usuario;
}

// Por defecto, sin permisos ni sucursales, como al darlo de alta (RF-00.2)
export async function crearAdministrador(
  ds: DataSource,
  datos: { username?: string; debeCambiarPassword?: boolean; permisos?: Permiso[]; sucursalIds?: string[] } = {},
): Promise<UsuarioCreado> {
  const admin = await insertarUsuario(ds, { ...datos, rol: ROLES.ADMIN, sucursalId: null });
  await darAcceso(ds, admin.id, datos.permisos ?? [], datos.sucursalIds ?? []);
  return admin;
}

export async function darAcceso(ds: DataSource, adminId: string, permisos: Permiso[], sucursalIds: string[]): Promise<void> {
  const superusuario = await obtenerSuperusuario(ds);
  for (const permiso of permisos) {
    await ds.query(`INSERT INTO usuarios_permisos (usuario_id, permiso, creado_por) VALUES ($1, $2, $3)`, [
      adminId,
      permiso,
      superusuario.id,
    ]);
  }
  for (const sucursalId of sucursalIds) {
    await ds.query(`INSERT INTO administradores_sucursales (usuario_id, sucursal_id, creado_por) VALUES ($1, $2, $3)`, [
      adminId,
      sucursalId,
      superusuario.id,
    ]);
  }
}

// El empleado no tiene usuario (D-34)
export function crearEmpleado(
  ds: DataSource,
  datos: { sucursalId: string; debeCambiarPassword?: boolean },
): Promise<UsuarioCreado> {
  return insertarUsuario(ds, { ...datos, rol: ROLES.EMPLEADO });
}

// Escenario base de alcance (technical-spec 7): dos empresas con una sucursal cada una y un
// administrador con todos los permisos en cada sucursal. Las dos sucursales venden la misma marca.
export async function crearDosSucursales(ds: DataSource) {
  const marca = await crearMarca(ds, { nombre: `Volkswagen ${sufijo()}` });
  const empresaA = await crearEmpresa(ds, { nombre: `Empresa A ${sufijo()}` });
  const empresaB = await crearEmpresa(ds, { nombre: `Empresa B ${sufijo()}` });
  const sucursalA = await crearSucursal(ds, { empresaId: empresaA.id, marcaId: marca.id, nombre: 'Sucursal A' });
  const sucursalB = await crearSucursal(ds, { empresaId: empresaB.id, marcaId: marca.id, nombre: 'Sucursal B' });
  const adminA = await crearAdministrador(ds, { permisos: TODOS_LOS_PERMISOS, sucursalIds: [sucursalA.id] });
  const adminB = await crearAdministrador(ds, { permisos: TODOS_LOS_PERMISOS, sucursalIds: [sucursalB.id] });
  return { marca, empresaA, empresaB, sucursalA, sucursalB, adminA, adminB };
}
