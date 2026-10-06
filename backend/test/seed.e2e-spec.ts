import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { sembrarRoles } from '../src/database/seeds/roles.seed.js';
import { sembrarSuperusuario, type DatosSuperusuario } from '../src/database/seeds/superusuario.seed.js';
import { crearDataSourcePruebas, limpiarBase } from './e2e/base-de-datos.js';

const datos: DatosSuperusuario = {
  username: 'superusuario',
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

  it('crea el superusuario sin sucursal, con la contraseña cifrada y obligado a cambiarla', async () => {
    expect(await sembrarSuperusuario(ds.manager, datos)).toBe('creado');

    const [usuario] = await ds.query(`SELECT * FROM usuarios WHERE rol = 'SUPERUSUARIO'`);
    expect(usuario).toMatchObject({ username: 'superusuario', sucursal_id: null, debe_cambiar_password: true });
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
  });
});
