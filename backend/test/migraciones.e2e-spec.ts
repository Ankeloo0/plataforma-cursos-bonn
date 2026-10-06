import { DataSource, QueryFailedError } from 'typeorm';
import { crearDataSourcePruebas, limpiarBase } from './e2e/base-de-datos.js';
import {
  crearAdministrador,
  crearDosSucursales,
  crearEmpleado,
  crearEmpresa,
  crearMarca,
  crearSucursal,
  obtenerSuperusuario,
} from './e2e/fabricas.js';

// Codigo de PostgreSQL de la restriccion violada, o undefined si la consulta no fallo
async function codigoDeError(consulta: Promise<unknown>): Promise<string | undefined> {
  try {
    await consulta;
    return undefined;
  } catch (error) {
    if (error instanceof QueryFailedError) return (error.driverError as { code: string }).code;
    throw error;
  }
}

// Las reglas criticas las protege la base aunque el codigo fallara (database-design 3.x, D-19, D-20)
describe('Migraciones 1 a 3: restricciones de la base', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = crearDataSourcePruebas();
    await ds.initialize();
  });

  beforeEach(async () => {
    await limpiarBase(ds);
  });

  afterAll(async () => {
    await limpiarBase(ds);
    await ds.destroy();
  });

  it('carga los tres roles fijos', async () => {
    const roles = await ds.query('SELECT clave FROM roles ORDER BY clave');
    expect(roles.map((r: { clave: string }) => r.clave)).toEqual(['ADMIN', 'EMPLEADO', 'SUPERUSUARIO']);
  });

  it('solo permite un superusuario (D-20)', async () => {
    await obtenerSuperusuario(ds);
    const codigo = await codigoDeError(
      ds.query(`INSERT INTO usuarios (rol, username, password_hash, nombres, apellido_paterno)
                VALUES ('SUPERUSUARIO', 'otro_super', 'x', 'Otro', 'Super')`),
    );
    expect(codigo).toBe('23505');
  });

  it('solo el empleado tiene sucursal: ni el superusuario ni el administrador (D-28)', async () => {
    const { sucursalA, adminA } = await crearDosSucursales(ds);
    expect(await codigoDeError(ds.query(`UPDATE usuarios SET sucursal_id = $1 WHERE rol = 'SUPERUSUARIO'`, [sucursalA.id]))).toBe(
      '23514',
    );
    expect(await codigoDeError(ds.query(`UPDATE usuarios SET sucursal_id = $1 WHERE id = $2`, [sucursalA.id, adminA.id]))).toBe(
      '23514',
    );
    const superusuario = await obtenerSuperusuario(ds);
    const empleadoSinSucursal = await codigoDeError(
      ds.query(`INSERT INTO usuarios (rol, password_hash, nombres, apellido_paterno, creado_por)
                VALUES ('EMPLEADO', 'x', 'A', 'B', $1)`, [superusuario.id]),
    );
    expect(empleadoSinSucursal).toBe('23514');
  });

  it('solo el empleado va sin usuario: entra con su número de empleado (D-34)', async () => {
    const { sucursalA, adminA } = await crearDosSucursales(ds);
    const superusuario = await obtenerSuperusuario(ds);
    const empleadoConUsuario = await codigoDeError(
      ds.query(`INSERT INTO usuarios (rol, sucursal_id, username, password_hash, nombres, apellido_paterno, creado_por)
                VALUES ('EMPLEADO', $1, 'empleado', 'x', 'A', 'B', $2)`, [sucursalA.id, superusuario.id]),
    );
    expect(empleadoConUsuario).toBe('23514');
    expect(await codigoDeError(ds.query(`UPDATE usuarios SET username = NULL WHERE id = $1`, [adminA.id]))).toBe('23514');
    expect(await codigoDeError(ds.query(`UPDATE usuarios SET username = NULL WHERE id = $1`, [superusuario.id]))).toBe('23514');
  });

  it('exige creador a administradores y empleados', async () => {
    const codigo = await codigoDeError(
      ds.query(`INSERT INTO usuarios (rol, username, password_hash, nombres, apellido_paterno)
                VALUES ('ADMIN', 'admin_sin_creador', 'x', 'A', 'B')`),
    );
    expect(codigo).toBe('23514');
  });

  it('trata el usuario, la empresa y la marca como únicos sin distinguir mayúsculas', async () => {
    await crearAdministrador(ds, { username: 'jperez' });
    expect(await codigoDeError(crearAdministrador(ds, { username: 'JPerez' }))).toBe('23505');
    await crearEmpresa(ds, { nombre: 'Grupo Norte' });
    expect(await codigoDeError(crearEmpresa(ds, { nombre: 'GRUPO NORTE' }))).toBe('23505');
    await crearMarca(ds, { nombre: 'Volkswagen' });
    expect(await codigoDeError(crearMarca(ds, { nombre: 'volkswagen' }))).toBe('23505');
  });

  it('el prefijo del folio es único y de 2 a 6 mayúsculas o dígitos (D-30)', async () => {
    await crearEmpresa(ds, { prefijoFolio: 'GB' });
    expect(await codigoDeError(crearEmpresa(ds, { prefijoFolio: 'GB' }))).toBe('23505');
    expect(await codigoDeError(crearEmpresa(ds, { prefijoFolio: 'gb' }))).toBe('23514');
    expect(await codigoDeError(crearEmpresa(ds, { prefijoFolio: 'G' }))).toBe('23514');
  });

  it('una sucursal exige marca, y su nombre es único dentro de su empresa (D-27)', async () => {
    const superusuario = await obtenerSuperusuario(ds);
    const empresa = await crearEmpresa(ds);
    const otra = await crearEmpresa(ds);
    const sinMarca = await codigoDeError(
      ds.query(`INSERT INTO sucursales (empresa_id, nombre, creado_por) VALUES ($1, 'Centro', $2)`, [empresa.id, superusuario.id]),
    );
    expect(sinMarca).toBe('23502');

    await crearSucursal(ds, { empresaId: empresa.id, nombre: 'Centro' });
    expect(await codigoDeError(crearSucursal(ds, { empresaId: empresa.id, nombre: 'CENTRO' }))).toBe('23505');
    await crearSucursal(ds, { empresaId: otra.id, nombre: 'Centro' });
  });

  it('rechaza permisos fuera del catálogo y casillas o sucursales repetidas (D-28)', async () => {
    const { adminA, sucursalA } = await crearDosSucursales(ds);
    const superusuario = await obtenerSuperusuario(ds);
    const insertarPermiso = (permiso: string) =>
      ds.query(`INSERT INTO usuarios_permisos (usuario_id, permiso, creado_por) VALUES ($1, $2, $3)`, [
        adminA.id,
        permiso,
        superusuario.id,
      ]);
    expect(await codigoDeError(insertarPermiso('HACER_TODO'))).toBe('23514');
    expect(await codigoDeError(insertarPermiso('REPORTES_VER'))).toBe('23505');
    const sucursalRepetida = await codigoDeError(
      ds.query(`INSERT INTO administradores_sucursales (usuario_id, sucursal_id, creado_por) VALUES ($1, $2, $3)`, [
        adminA.id,
        sucursalA.id,
        superusuario.id,
      ]),
    );
    expect(sucursalRepetida).toBe('23505');
  });

  it('rechaza un rol que no existe', async () => {
    const superusuario = await obtenerSuperusuario(ds);
    const codigo = await codigoDeError(
      ds.query(`INSERT INTO usuarios (rol, username, password_hash, nombres, apellido_paterno, creado_por)
                VALUES ('INVITADO', 'invitado', 'x', 'A', 'B', $1)`, [superusuario.id]),
    );
    expect(codigo).toBe('23503');
  });

  it('deja al usuario sin foto si se borra su archivo', async () => {
    const admin = await crearAdministrador(ds);
    const [archivo] = await ds.query(
      `INSERT INTO archivos (storage_key, nombre_original, mime_type, tamano_bytes, creado_por)
       VALUES ('fotos/2026/10/a.webp', 'yo.webp', 'image/webp', 1024, $1) RETURNING id`,
      [admin.id],
    );
    await ds.query('UPDATE usuarios SET foto_archivo_id = $1 WHERE id = $2', [archivo.id, admin.id]);
    await ds.query('DELETE FROM archivos WHERE id = $1', [archivo.id]);

    const [usuario] = await ds.query('SELECT foto_archivo_id FROM usuarios WHERE id = $1', [admin.id]);
    expect(usuario.foto_archivo_id).toBeNull();
  });

  it('impide borrar a un usuario que creó otros registros, y una sucursal con empleados (auditoría, D-06)', async () => {
    const { sucursalA } = await crearDosSucursales(ds);
    await crearEmpleado(ds, { sucursalId: sucursalA.id });
    const superusuario = await obtenerSuperusuario(ds);
    expect(await codigoDeError(ds.query('DELETE FROM usuarios WHERE id = $1', [superusuario.id]))).toBe('23503');
    expect(await codigoDeError(ds.query('DELETE FROM sucursales WHERE id = $1', [sucursalA.id]))).toBe('23503');
  });

  it('la migración 2 conserva los datos de la 1: prefijo provisional para las empresas y administradores sin empresa', async () => {
    const superusuario = await obtenerSuperusuario(ds);
    await ds.undoLastMigration();
    await ds.undoLastMigration();
    try {
      const [empresa] = await ds.query(`INSERT INTO empresas (nombre, creado_por) VALUES ('Agencia previa', $1) RETURNING id`, [
        superusuario.id,
      ]);
      await ds.query(
        `INSERT INTO usuarios (rol, empresa_id, username, password_hash, nombres, apellido_paterno, creado_por)
         VALUES ('ADMIN', $1, 'admin_previo', 'x', 'A', 'B', $2)`,
        [empresa.id, superusuario.id],
      );
    } finally {
      await ds.runMigrations();
    }

    const [empresa] = await ds.query(`SELECT prefijo_folio FROM empresas WHERE nombre = 'Agencia previa'`);
    expect(empresa.prefijo_folio).toBe('E001');
    const [admin] = await ds.query(`SELECT sucursal_id FROM usuarios WHERE username = 'admin_previo'`);
    expect(admin.sucursal_id).toBeNull();
  });
});
