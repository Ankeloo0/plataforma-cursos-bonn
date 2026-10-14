import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { sembrarRoles } from '../src/database/seeds/roles.seed.js';
import { sembrarSuperusuario, type DatosSuperusuario } from '../src/database/seeds/superusuario.seed.js';
import { crearDataSourcePruebas, limpiarBase } from './e2e/base-de-datos.js';

const datos: DatosSuperusuario = {
  empresa: 'Grupo Bonn',
  prefijoFolio: 'GB',
  numeroEmpleado: '1',
  password: 'Temporal2026',
  nombres: 'Ana',
  apellidoPaterno: 'López',
};

describe('Seed de la instalación', () => {
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

  it('crea el superusuario sin sucursal, con su empresa y su número, la contraseña cifrada y obligado a cambiarla', async () => {
    expect(await sembrarSuperusuario(ds.manager, datos)).toBe('creado');

    const [usuario] = await ds.query(`SELECT * FROM usuarios WHERE rol = 'SUPERUSUARIO'`);
    const [empresa] = await ds.query(`SELECT * FROM empresas`);
    expect(empresa).toMatchObject({ nombre: 'Grupo Bonn', prefijo_folio: 'GB', creado_por: usuario.id });
    expect(usuario).toMatchObject({ empresa_id: empresa.id, numero_empleado: '1', sucursal_id: null, debe_cambiar_password: true });
    expect(usuario.password_hash).not.toContain('Temporal2026');
    expect(await bcrypt.compare('Temporal2026', usuario.password_hash)).toBe(true);
  });

  it('es idempotente: la segunda vez no crea otro ni cambia la contraseña', async () => {
    await sembrarRoles(ds.manager);
    await sembrarSuperusuario(ds.manager, datos);
    const [antes] = await ds.query(`SELECT password_hash FROM usuarios WHERE rol = 'SUPERUSUARIO'`);

    await sembrarRoles(ds.manager);
    expect(await sembrarSuperusuario(ds.manager, { ...datos, password: 'OtraClave99' })).toBe('ya-existia');

    const usuarios = await ds.query(`SELECT password_hash FROM usuarios WHERE rol = 'SUPERUSUARIO'`);
    expect(usuarios).toEqual([antes]);
    expect((await ds.query('SELECT clave FROM roles')).length).toBe(3);
    expect((await ds.query('SELECT id FROM empresas')).length).toBe(1);
  });

  it('a un superusuario anterior sin número le asigna una empresa que ya existe, sin crear otra', async () => {
    await sembrarRoles(ds.manager);
    const [{ id }] = await ds.query(
      `INSERT INTO usuarios (rol, password_hash, nombres, apellido_paterno) VALUES ('SUPERUSUARIO', 'x', 'Ana', 'López') RETURNING id`,
    );
    const [empresa] = await ds.query(
      `INSERT INTO empresas (nombre, prefijo_folio, creado_por) VALUES ('GRUPO BONN', 'GBX', $1) RETURNING id`,
      [id],
    );

    expect(await sembrarSuperusuario(ds.manager, datos)).toBe('numero-asignado');
    const [usuario] = await ds.query(`SELECT empresa_id, numero_empleado, password_hash FROM usuarios WHERE id = $1`, [id]);
    expect(usuario).toEqual({ empresa_id: empresa.id, numero_empleado: '1', password_hash: 'x' });
    expect((await ds.query('SELECT id FROM empresas')).length).toBe(1);
  });
});
