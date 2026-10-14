import request from 'supertest';
import { TODOS_LOS_PERMISOS } from '../src/common/constants/permisos.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import {
  crearAdministrador,
  crearEmpleado,
  crearEmpresa,
  crearSucursal,
  obtenerSuperusuario,
  PASSWORD_PRUEBA,
} from './e2e/fabricas.js';
import { cookieDe, iniciarSesion } from './e2e/sesion.js';

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

  //el administrador tiene su numero en la misma empresa que administra
  async function adminDeAgencia(datos: { debeCambiarPassword?: boolean } = {}) {
    const empresa = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Centro' });
    const sucursal = await crearSucursal(e2e.dataSource, { empresaId: empresa.id, nombre: 'Sucursal Centro' });
    const admin = await crearAdministrador(e2e.dataSource, {
      ...datos,
      empresaId: empresa.id,
      numeroEmpleado: 'A-100',
      permisos: TODOS_LOS_PERMISOS,
      sucursalIds: [sucursal.id],
    });
    return { empresa, sucursal, admin };
  }

  //solo los tres campos: el DTO rechaza cualquier otro
  const login = ({ empresaId, numeroEmpleado, password = PASSWORD_PRUEBA }: { empresaId: string; numeroEmpleado: string; password?: string }) =>
    http().post('/api/v1/auth/login').send({ empresaId, numeroEmpleado, password });

  describe('POST /auth/login', () => {
    it('entrega la sesión en una cookie httpOnly y SameSite=Strict, y devuelve el perfil sin datos sensibles', async () => {
      const { empresa, admin } = await adminDeAgencia();

      const respuesta = await login({ empresaId: empresa.id, numeroEmpleado: 'A-100' }).expect(200);

      const cookie = String(respuesta.headers['set-cookie']);
      expect(cookie).toMatch(/bonn_sesion=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api/);
      expect(respuesta.body).toMatchObject({
        id: admin.id,
        rol: 'ADMIN',
        numeroEmpleado: 'A-100',
        empresa: { id: empresa.id, nombre: 'Grupo Centro' },
        permisos: expect.arrayContaining(TODOS_LOS_PERMISOS),
        sucursales: [{ nombre: 'Sucursal Centro', empresa: { nombre: 'Grupo Centro' } }],
        sucursal: null,
        debeCambiarPassword: false,
      });
      expect(JSON.stringify(respuesta.body)).not.toMatch(/passwordHash|password_hash|token/i);
    });

    it('los tres roles entran por el mismo acceso', async () => {
      const { sucursal, admin } = await adminDeAgencia();
      const superusuario = await obtenerSuperusuario(e2e.dataSource);
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id, numeroEmpleado: '1024' });

      const deSuper = await login(superusuario).expect(200);
      const deAdmin = await login(admin).expect(200);
      const deEmpleado = await login(empleado).expect(200);
      expect([deSuper.body.rol, deAdmin.body.rol, deEmpleado.body.rol]).toEqual(['SUPERUSUARIO', 'ADMIN', 'EMPLEADO']);
      expect(deEmpleado.body).toMatchObject({ numeroEmpleado: '1024', empleado: { puesto: expect.any(Object) } });
    });

    it('valida que lleguen la empresa, el número de empleado y la contraseña', async () => {
      const respuesta = await http()
        .post('/api/v1/auth/login')
        .send({ empresaId: 'no-es-uuid', numeroEmpleado: '', password: PASSWORD_PRUEBA })
        .expect(400);
      expect(JSON.stringify(respuesta.body)).toMatch(/Elige tu empresa/);
    });

    it('el mismo número en otra empresa es otra cuenta, aunque sea de otro rol', async () => {
      const { sucursal } = await adminDeAgencia();
      const otraEmpresa = await crearEmpresa(e2e.dataSource);
      const otraSucursal = await crearSucursal(e2e.dataSource, { empresaId: otraEmpresa.id });
      const ana = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id, numeroEmpleado: '1024' });
      const luis = await crearEmpleado(e2e.dataSource, { sucursalId: otraSucursal.id, numeroEmpleado: '1024' });
      const admin = await crearAdministrador(e2e.dataSource, { empresaId: otraEmpresa.id, numeroEmpleado: '2048' });

      expect((await login({ empresaId: ana.empresaId, numeroEmpleado: '1024' }).expect(200)).body.id).toBe(ana.id);
      expect((await login({ empresaId: luis.empresaId, numeroEmpleado: '1024' }).expect(200)).body.id).toBe(luis.id);
      expect((await login({ empresaId: otraEmpresa.id, numeroEmpleado: '2048' }).expect(200)).body.id).toBe(admin.id);
    });

    it('el número no se repite en la empresa entre roles distintos', async () => {
      const { sucursal } = await adminDeAgencia();
      const intento = crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id, numeroEmpleado: 'a-100' });
      await expect(intento).rejects.toThrow(/uq_usuarios_empresa_numero_ci/);
    });

    it('no distingue mayúsculas en el número de empleado', async () => {
      const { empresa } = await adminDeAgencia();
      await login({ empresaId: empresa.id, numeroEmpleado: 'a-100' }).expect(200);
    });

    it('responde lo mismo si el número no existe en la empresa o si la contraseña es incorrecta (RN-01.6)', async () => {
      const { empresa } = await adminDeAgencia();
      const otraEmpresa = await crearEmpresa(e2e.dataSource);

      const noExiste = await login({ empresaId: empresa.id, numeroEmpleado: '9999' }).expect(401);
      const otraEmpresaMismoNumero = await login({ empresaId: otraEmpresa.id, numeroEmpleado: 'A-100' }).expect(401);
      const malaPassword = await login({ empresaId: empresa.id, numeroEmpleado: 'A-100', password: 'Mala12345' }).expect(401);
      expect(malaPassword.body).toEqual(noExiste.body);
      expect(otraEmpresaMismoNumero.body).toEqual(noExiste.body);
      expect(noExiste.body).toMatchObject({
        code: 'CREDENCIALES_INVALIDAS',
        message: 'Empresa, número de empleado o contraseña incorrectos.',
      });
    });

    it('bloquea la cuenta tras 5 intentos fallidos seguidos, aunque después la contraseña sea correcta (RN-01.7)', async () => {
      const { admin } = await adminDeAgencia();
      for (let i = 0; i < 5; i++) {
        await login({ ...admin, password: 'Mala12345' }).expect(401);
      }

      const respuesta = await login(admin).expect(429);
      expect(respuesta.body.code).toBe('CUENTA_BLOQUEADA');
      expect(respuesta.body.message).toMatch(/15 minutos/);
    });

    it('un acceso correcto reinicia el contador de intentos fallidos', async () => {
      const { admin } = await adminDeAgencia();
      for (let i = 0; i < 4; i++) {
        await login({ ...admin, password: 'Mala12345' }).expect(401);
      }
      await iniciarSesion(e2e.app, admin);

      const [fila] = await e2e.dataSource.query('SELECT intentos_fallidos, ultimo_acceso_en FROM usuarios WHERE id = $1', [admin.id]);
      expect(fila.intentos_fallidos).toBe(0);
      expect(fila.ultimo_acceso_en).not.toBeNull();
    });

    it('el administrador entra aunque su sucursal esté inactiva, pero ya no la ve (RN-00.8)', async () => {
      const { sucursal, admin } = await adminDeAgencia();
      await e2e.dataSource.query('UPDATE sucursales SET activo = false WHERE id = $1', [sucursal.id]);

      const cookie = await iniciarSesion(e2e.app, admin);
      const me = await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body.sucursales).toEqual([]);
    });

    it('con la empresa inactiva no entra nadie registrado en ella; la sucursal inactiva solo detiene al empleado (RN-00.3, RN-00.8)', async () => {
      const { empresa, sucursal, admin } = await adminDeAgencia();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id });

      await e2e.dataSource.query('UPDATE empresas SET activo = false WHERE id = $1', [empresa.id]);
      expect((await login(empleado).expect(401)).body.code).toBe('CREDENCIALES_INVALIDAS');
      await login(admin).expect(401);

      await e2e.dataSource.query('UPDATE empresas SET activo = true WHERE id = $1', [empresa.id]);
      await e2e.dataSource.query('UPDATE sucursales SET activo = false WHERE id = $1', [sucursal.id]);
      await login(empleado).expect(401);
      await login(admin).expect(200);
    });

    it('ya no existe el acceso separado de empleados', async () => {
      await http().post('/api/v1/auth/login-empleado').send({}).expect(404);
    });
  });

  describe('GET /auth/empresas', () => {
    it('es pública y solo da id y nombre de las empresas activas, en orden alfabético', async () => {
      const superusuario = await obtenerSuperusuario(e2e.dataSource);
      await e2e.dataSource.query(`UPDATE empresas SET nombre = 'Corporativo' WHERE id = $1`, [superusuario.empresaId]);
      const norte = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Norte' });
      const bonn = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Bonn' });
      const inactiva = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Inactivo' });
      await e2e.dataSource.query('UPDATE empresas SET activo = false WHERE id = $1', [inactiva.id]);

      const respuesta = await http().get('/api/v1/auth/empresas').expect(200);
      expect(respuesta.body).toEqual([
        { id: superusuario.empresaId, nombre: 'Corporativo' },
        { id: bonn.id, nombre: 'Grupo Bonn' },
        { id: norte.id, nombre: 'Grupo Norte' },
      ]);
    });
  });

  describe('Sesión en cada petición', () => {
    it('acepta el token solo en la cookie httpOnly, no en la cabecera Authorization (T-05)', async () => {
      const { admin } = await adminDeAgencia();
      const cookie = await iniciarSesion(e2e.app, admin);
      const token = cookie.split('=')[1];

      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('rechaza peticiones sin sesión o con un token alterado', async () => {
      await http().get('/api/v1/auth/me').expect(401);
      const respuesta = await http().get('/api/v1/auth/me').set('Cookie', 'bonn_sesion=token.inventado.x').expect(401);
      expect(respuesta.body.code).toBe('SESION_REQUERIDA');
    });

    it('cierra las sesiones abiertas de su empresa si esta se desactiva', async () => {
      const { empresa, sucursal, admin } = await adminDeAgencia();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursal.id });
      const cookieEmpleado = await iniciarSesion(e2e.app, empleado);
      const cookieAdmin = await iniciarSesion(e2e.app, admin);
      await http().get('/api/v1/auth/me').set('Cookie', cookieEmpleado).expect(200);

      await e2e.dataSource.query('UPDATE empresas SET activo = false WHERE id = $1', [empresa.id]);
      await http().get('/api/v1/auth/me').set('Cookie', cookieEmpleado).expect(401);
      await http().get('/api/v1/auth/me').set('Cookie', cookieAdmin).expect(401);
    });

    it('un rol sin permiso recibe 403', async () => {
      const { admin } = await adminDeAgencia();
      const cookie = await iniciarSesion(e2e.app, admin);
      const respuesta = await http().get('/api/v1/empresas').set('Cookie', cookie).expect(403);
      expect(respuesta.body.code).toBe('SIN_PERMISO');
    });
  });

  describe('Contraseña temporal (HU-02)', () => {
    it('solo permite consultar la sesión y cambiar la contraseña hasta crear una nueva', async () => {
      const { admin } = await adminDeAgencia({ debeCambiarPassword: true });
      const cookie = await iniciarSesion(e2e.app, admin);

      const me = await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body.debeCambiarPassword).toBe(true);

      const bloqueada = await http().get('/api/v1/perfil').set('Cookie', cookie).expect(403);
      expect(bloqueada.body.code).toBe('DEBE_CAMBIAR_PASSWORD');
    });

    it('al crear la contraseña entrega una sesión nueva y la anterior deja de valer', async () => {
      const { admin } = await adminDeAgencia({ debeCambiarPassword: true });
      const anterior = await iniciarSesion(e2e.app, admin);

      const respuesta = await http()
        .post('/api/v1/auth/cambiar-password')
        .set('Cookie', anterior)
        .send({ passwordActual: PASSWORD_PRUEBA, passwordNueva: 'MiClave2026' })
        .expect(200);
      const nueva = cookieDe(respuesta.headers['set-cookie']);

      expect(respuesta.body.debeCambiarPassword).toBe(false);
      await http().get('/api/v1/perfil').set('Cookie', nueva).expect(200);
      await http().get('/api/v1/auth/me').set('Cookie', anterior).expect(401);
      await iniciarSesion(e2e.app, admin, 'MiClave2026');
    });

    it('aplica la política de contraseñas (RN-01.5) y pide la contraseña actual correcta', async () => {
      const { admin } = await adminDeAgencia({ debeCambiarPassword: true });
      const cookie = await iniciarSesion(e2e.app, admin);

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
