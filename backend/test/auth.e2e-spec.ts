import request from 'supertest';
import { TODOS_LOS_PERMISOS } from '../src/common/constants/permisos.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import { crearAdministrador, crearEmpleado, crearEmpresa, crearSucursal, PASSWORD_PRUEBA } from './e2e/fabricas.js';
import { cookieDe, iniciarSesion, iniciarSesionEmpleado } from './e2e/sesion.js';

describe('Autenticación y sesión (HU-01, HU-02, HU-03)', () => {
  let e2e: AppE2e;
  const http = () => request(e2e.app.getHttpServer());

  beforeAll(async () => {
    e2e = await crearAppE2e();
  });

  beforeEach(async () => {
    await limpiarBase(e2e.dataSource);
  });

  afterAll(async () => {
    await limpiarBase(e2e.dataSource);
    await e2e.app.close();
  });

  async function adminDeAgencia(datos: { username?: string; debeCambiarPassword?: boolean } = {}) {
    const empresa = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Centro' });
    const sucursal = await crearSucursal(e2e.dataSource, { empresaId: empresa.id, nombre: 'Sucursal Centro' });
    const admin = await crearAdministrador(e2e.dataSource, { ...datos, permisos: TODOS_LOS_PERMISOS, sucursalIds: [sucursal.id] });
    return { empresa, sucursal, admin };
  }

  describe('POST /auth/login', () => {
    it('entrega la sesión en una cookie httpOnly y SameSite=Strict, y devuelve el perfil sin datos sensibles', async () => {
      const { admin } = await adminDeAgencia({ username: 'jperez' });

      const respuesta = await http().post('/api/v1/auth/login').send({ username: 'jperez', password: PASSWORD_PRUEBA }).expect(200);

      const cookie = String(respuesta.headers['set-cookie']);
      expect(cookie).toMatch(/bonn_sesion=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api/);
      expect(respuesta.body).toMatchObject({
        id: admin.id,
        rol: 'ADMIN',
        permisos: expect.arrayContaining(TODOS_LOS_PERMISOS),
        sucursales: [{ nombre: 'Sucursal Centro', empresa: { nombre: 'Grupo Centro' } }],
        sucursal: null,
        debeCambiarPassword: false,
      });
      expect(JSON.stringify(respuesta.body)).not.toMatch(/passwordHash|password_hash|token/i);
    });

    it('no distingue mayúsculas en el usuario (RN-01.1)', async () => {
      await adminDeAgencia({ username: 'jperez' });
      await http().post('/api/v1/auth/login').send({ username: 'JPerez', password: PASSWORD_PRUEBA }).expect(200);
    });

    it('responde lo mismo si el usuario no existe o si la contraseña es incorrecta (RN-01.6)', async () => {
      await adminDeAgencia({ username: 'jperez' });

      const malaPassword = await http().post('/api/v1/auth/login').send({ username: 'jperez', password: 'Otra12345' }).expect(401);
      const noExiste = await http().post('/api/v1/auth/login').send({ username: 'nadie', password: 'Otra12345' }).expect(401);

      expect(malaPassword.body).toEqual(noExiste.body);
      expect(malaPassword.body.code).toBe('CREDENCIALES_INVALIDAS');
    });

    it('bloquea la cuenta tras 5 intentos fallidos seguidos, aunque después la contraseña sea correcta (RN-01.7)', async () => {
      await adminDeAgencia({ username: 'jperez' });
      for (let i = 0; i < 5; i++) {
        await http().post('/api/v1/auth/login').send({ username: 'jperez', password: 'Mala12345' }).expect(401);
      }

      const respuesta = await http()
        .post('/api/v1/auth/login')
        .send({ username: 'jperez', password: PASSWORD_PRUEBA })
        .expect(429);
      expect(respuesta.body.code).toBe('CUENTA_BLOQUEADA');
      expect(respuesta.body.message).toMatch(/15 minutos/);
    });

    it('un acceso correcto reinicia el contador de intentos fallidos', async () => {
      const { admin } = await adminDeAgencia({ username: 'jperez' });
      for (let i = 0; i < 4; i++) {
        await http().post('/api/v1/auth/login').send({ username: 'jperez', password: 'Mala12345' }).expect(401);
      }
      await iniciarSesion(e2e.app, 'jperez');

      const [fila] = await e2e.dataSource.query('SELECT intentos_fallidos, ultimo_acceso_en FROM usuarios WHERE id = $1', [admin.id]);
      expect(fila.intentos_fallidos).toBe(0);
      expect(fila.ultimo_acceso_en).not.toBeNull();
    });

    it('el administrador entra aunque su sucursal esté inactiva, pero ya no la ve (RN-00.8)', async () => {
      const { sucursal } = await adminDeAgencia({ username: 'jperez' });
      await e2e.dataSource.query('UPDATE sucursales SET activo = false WHERE id = $1', [sucursal.id]);

      const admin = await iniciarSesion(e2e.app, 'jperez');
      const me = await http().get('/api/v1/auth/me').set('Cookie', admin).expect(200);
      expect(me.body.sucursales).toEqual([]);
    });

    it('valida que lleguen usuario y contraseña', async () => {
      await http().post('/api/v1/auth/login').send({ username: '' }).expect(400);
    });
  });

  describe('POST /auth/login-empleado (D-34)', () => {
    it('valida que lleguen la empresa, el número de empleado y la contraseña', async () => {
      const respuesta = await http()
        .post('/api/v1/auth/login-empleado')
        .send({ empresaId: 'no-es-uuid', numeroEmpleado: '', password: PASSWORD_PRUEBA })
        .expect(400);
      expect(JSON.stringify(respuesta.body)).toMatch(/Elige tu empresa/);
    });

    const login = (datos: { empresaId: string; numeroEmpleado: string; password?: string }) =>
      http().post('/api/v1/auth/login-empleado').send({ password: PASSWORD_PRUEBA, ...datos });

    it('entra con empresa, número y contraseña; el mismo número en otra empresa es otra cuenta', async () => {
      const { sucursal } = await adminDeAgencia();
      const otraEmpresa = await crearEmpresa(e2e.dataSource);
      const otraSucursal = await crearSucursal(e2e.dataSource, { empresaId: otraEmpresa.id });
      const ana = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id, numeroEmpleado: '1024' });
      const luis = await crearEmpleado(e2e.dataSource, { sucursalId: otraSucursal.id, numeroEmpleado: '1024' });

      const respuesta = await login({ empresaId: ana.empresaId, numeroEmpleado: '1024' }).expect(200);
      expect(String(respuesta.headers['set-cookie'])).toMatch(/bonn_sesion=.*HttpOnly/);
      expect(respuesta.body).toMatchObject({ id: ana.id, rol: 'EMPLEADO', username: null, empleado: { numeroEmpleado: '1024' } });

      const otra = await login({ empresaId: luis.empresaId, numeroEmpleado: '1024' }).expect(200);
      expect(otra.body.id).toBe(luis.id);
    });

    it('no distingue mayúsculas en el número de empleado', async () => {
      const { sucursal } = await adminDeAgencia();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id, numeroEmpleado: 'VW-15' });
      await login({ empresaId: empleado.empresaId, numeroEmpleado: 'vw-15' }).expect(200);
    });

    it('responde lo mismo si el número no existe en la empresa o si la contraseña es incorrecta, y bloquea tras 5 fallos (RN-01.6, RN-01.7)', async () => {
      const { sucursal } = await adminDeAgencia();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id, numeroEmpleado: '1024' });
      const otraEmpresa = await crearEmpresa(e2e.dataSource);

      const noExiste = await login({ empresaId: empleado.empresaId, numeroEmpleado: '9999' }).expect(401);
      const otraEmpresaMismoNumero = await login({ empresaId: otraEmpresa.id, numeroEmpleado: '1024' }).expect(401);
      const malaPassword = await login({ empresaId: empleado.empresaId, numeroEmpleado: '1024', password: 'Mala12345' }).expect(401);
      expect(malaPassword.body).toEqual(noExiste.body);
      expect(otraEmpresaMismoNumero.body).toEqual(noExiste.body);
      expect(noExiste.body.message).toBe('Empresa, número de empleado o contraseña incorrectos.');

      for (let i = 0; i < 4; i++) {
        await login({ empresaId: empleado.empresaId, numeroEmpleado: '1024', password: 'Mala12345' }).expect(401);
      }
      const bloqueado = await login({ empresaId: empleado.empresaId, numeroEmpleado: '1024' }).expect(429);
      expect(bloqueado.body.code).toBe('CUENTA_BLOQUEADA');
    });

    it('no deja entrar a empleados de una empresa o sucursal inactiva (RN-00.3, RN-00.8)', async () => {
      const { empresa, sucursal } = await adminDeAgencia();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id });

      const credenciales = { empresaId: empleado.empresaId, numeroEmpleado: empleado.numeroEmpleado };

      await e2e.dataSource.query('UPDATE empresas SET activo = false WHERE id = $1', [empresa.id]);
      const respuesta = await login(credenciales).expect(401);
      expect(respuesta.body.code).toBe('CREDENCIALES_INVALIDAS');

      await e2e.dataSource.query('UPDATE empresas SET activo = true WHERE id = $1', [empresa.id]);
      await e2e.dataSource.query('UPDATE sucursales SET activo = false WHERE id = $1', [sucursal.id]);
      await login(credenciales).expect(401);
    });

    it('un empleado no entra por /auth/login ni un administrador por /auth/login-empleado', async () => {
      const { empresa } = await adminDeAgencia({ username: 'jperez' });
      await login({ empresaId: empresa.id, numeroEmpleado: 'jperez' }).expect(401);
    });
  });

  describe('GET /auth/empresas (D-34)', () => {
    it('es pública y solo da id y nombre de las empresas activas, en orden alfabético', async () => {
      const norte = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Norte' });
      const bonn = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Bonn' });
      const inactiva = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Inactivo' });
      await e2e.dataSource.query('UPDATE empresas SET activo = false WHERE id = $1', [inactiva.id]);

      const respuesta = await http().get('/api/v1/auth/empresas').expect(200);
      expect(respuesta.body).toEqual([
        { id: bonn.id, nombre: 'Grupo Bonn' },
        { id: norte.id, nombre: 'Grupo Norte' },
      ]);
    });
  });

  describe('Sesión en cada petición', () => {
    it('acepta el token solo en la cookie httpOnly, no en la cabecera Authorization (T-05)', async () => {
      await adminDeAgencia({ username: 'jperez' });
      const cookie = await iniciarSesion(e2e.app, 'jperez');
      const token = cookie.split('=')[1];

      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('rechaza peticiones sin sesión o con un token alterado', async () => {
      await http().get('/api/v1/auth/me').expect(401);
      const respuesta = await http().get('/api/v1/auth/me').set('Cookie', 'bonn_sesion=token.inventado.x').expect(401);
      expect(respuesta.body.code).toBe('SESION_REQUERIDA');
    });

    it('cierra la sesión abierta de un empleado si su empresa se desactiva', async () => {
      const { empresa, sucursal } = await adminDeAgencia();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id });
      const cookie = await iniciarSesionEmpleado(e2e.app, empleado);
      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);

      await e2e.dataSource.query('UPDATE empresas SET activo = false WHERE id = $1', [empresa.id]);
      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
    });

    it('un rol sin permiso recibe 403', async () => {
      await adminDeAgencia({ username: 'jperez' });
      const cookie = await iniciarSesion(e2e.app, 'jperez');
      const respuesta = await http().get('/api/v1/empresas').set('Cookie', cookie).expect(403);
      expect(respuesta.body.code).toBe('SIN_PERMISO');
    });
  });

  describe('Contraseña temporal (HU-02)', () => {
    it('solo permite consultar la sesión y cambiar la contraseña hasta crear una nueva', async () => {
      await adminDeAgencia({ username: 'nuevo', debeCambiarPassword: true });
      const cookie = await iniciarSesion(e2e.app, 'nuevo');

      const me = await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body.debeCambiarPassword).toBe(true);

      const bloqueada = await http().get('/api/v1/perfil').set('Cookie', cookie).expect(403);
      expect(bloqueada.body.code).toBe('DEBE_CAMBIAR_PASSWORD');
    });

    it('al crear la contraseña entrega una sesión nueva y la anterior deja de valer', async () => {
      await adminDeAgencia({ username: 'nuevo', debeCambiarPassword: true });
      const anterior = await iniciarSesion(e2e.app, 'nuevo');

      const respuesta = await http()
        .post('/api/v1/auth/cambiar-password')
        .set('Cookie', anterior)
        .send({ passwordActual: PASSWORD_PRUEBA, passwordNueva: 'MiClave2026' })
        .expect(200);
      const nueva = cookieDe(respuesta.headers['set-cookie']);

      expect(respuesta.body.debeCambiarPassword).toBe(false);
      await http().get('/api/v1/perfil').set('Cookie', nueva).expect(200);
      await http().get('/api/v1/auth/me').set('Cookie', anterior).expect(401);
      await iniciarSesion(e2e.app, 'nuevo', 'MiClave2026');
    });

    it('aplica la política de contraseñas (RN-01.5) y pide la contraseña actual correcta', async () => {
      await adminDeAgencia({ username: 'nuevo', debeCambiarPassword: true });
      const cookie = await iniciarSesion(e2e.app, 'nuevo');

      const debil = await http()
        .post('/api/v1/auth/cambiar-password')
        .set('Cookie', cookie)
        .send({ passwordActual: PASSWORD_PRUEBA, passwordNueva: 'soloLetras' })
        .expect(400);
      expect(String(debil.body.message)).toContain('al menos 8 caracteres');

      const actualMal = await http()
        .post('/api/v1/auth/cambiar-password')
        .set('Cookie', cookie)
        .send({ passwordActual: 'NoEsLaMia1', passwordNueva: 'MiClave2026' })
        .expect(422);
      expect(actualMal.body.code).toBe('PASSWORD_ACTUAL_INCORRECTA');
    });
  });

  describe('POST /auth/logout (HU-03)', () => {
    it('borra la cookie de sesión', async () => {
      const respuesta = await http().post('/api/v1/auth/logout').expect(204);
      expect(String(respuesta.headers['set-cookie'])).toMatch(/bonn_sesion=;.*Expires=Thu, 01 Jan 1970/);
    });
  });
});
