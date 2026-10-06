import request from 'supertest';
import { PERMISOS, TODOS_LOS_PERMISOS } from '../src/common/constants/permisos.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import {
  crearAdministrador,
  crearDosSucursales,
  crearEmpleado,
  crearSucursal,
  obtenerSuperusuario,
} from './e2e/fabricas.js';
import { cookieDe, iniciarSesion } from './e2e/sesion.js';

const NUEVO_ADMIN = {
  nombres: 'Juan',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: '',
  username: 'jperez',
  passwordTemporal: 'Temporal2026',
};

describe('Administradores, permisos y sucursales (HU-51, HU-52, HU-53)', () => {
  let e2e: AppE2e;
  let superCookie: string;
  const http = () => request(e2e.app.getHttpServer());

  beforeAll(async () => {
    e2e = await crearAppE2e();
  });

  beforeEach(async () => {
    await limpiarBase(e2e.dataSource);
    superCookie = await iniciarSesion(e2e.app, (await obtenerSuperusuario(e2e.dataSource)).username);
  });

  afterAll(async () => {
    await limpiarBase(e2e.dataSource);
    await e2e.app.close();
  });

  it('recorrido de la demo: alta sin permisos, se le asignan permisos y sucursales, y entra a ver solo lo suyo (HU-00)', async () => {
    const { sucursalA } = await crearDosSucursales(e2e.dataSource);

    const creado = await http().post('/api/v1/administradores').set('Cookie', superCookie).send(NUEVO_ADMIN).expect(201);
    expect(creado.body).toMatchObject({ rol: 'ADMIN', username: 'jperez', sucursalId: null, apellidoMaterno: null, debeCambiarPassword: true });
    expect(JSON.stringify(creado.body)).not.toMatch(/password_hash|passwordHash|Temporal2026/);

    const ficha = await http().get(`/api/v1/administradores/${creado.body.id}`).set('Cookie', superCookie).expect(200);
    expect(ficha.body).toMatchObject({ permisos: [], sucursales: [] });

    const temporal = await iniciarSesion(e2e.app, 'jperez', 'Temporal2026');
    const cambio = await http()
      .post('/api/v1/auth/cambiar-password')
      .set('Cookie', temporal)
      .send({ passwordActual: 'Temporal2026', passwordNueva: 'MiClave2026' })
      .expect(200);
    const cookie = cookieDe(cambio.headers['set-cookie']);
    expect(cambio.body).toMatchObject({ permisos: [], sucursales: [] });
    await http().get('/api/v1/sucursales').set('Cookie', cookie).expect(403);

    const acceso = await http()
      .put(`/api/v1/administradores/${creado.body.id}/acceso`)
      .set('Cookie', superCookie)
      .send({ permisos: [PERMISOS.EMPLEADOS_VER, PERMISOS.REPORTES_VER], sucursalIds: [sucursalA.id] })
      .expect(200);
    expect(acceso.body.permisos.sort()).toEqual([PERMISOS.EMPLEADOS_VER, PERMISOS.REPORTES_VER].sort());
    expect(acceso.body.sucursales).toMatchObject([{ id: sucursalA.id, nombre: 'Sucursal A' }]);
    expect(acceso.body.actualizadoEn).not.toBe(creado.body.actualizadoEn);

    // Sin cerrar su sesion, la siguiente peticion ya ve sus permisos nuevos (RN-00.10)
    const me = await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.sucursales.map((s: { id: string }) => s.id)).toEqual([sucursalA.id]);
    const suyas = await http().get('/api/v1/sucursales').set('Cookie', cookie).expect(200);
    expect(suyas.body.map((s: { id: string }) => s.id)).toEqual([sucursalA.id]);
  });

  it('entrega el catálogo de permisos y las plantillas para la pantalla', async () => {
    const respuesta = await http().get('/api/v1/permisos/catalogo').set('Cookie', superCookie).expect(200);
    expect(respuesta.body.permisos.map((p: { permiso: string }) => p.permiso)).toEqual(TODOS_LOS_PERMISOS);
    expect(respuesta.body.plantillas.map((p: { clave: string }) => p.clave)).toEqual([
      'ADMIN_COMPLETO',
      'ADMIN_SUCURSAL',
      'CREADOR_CONTENIDO',
      'SOLO_REPORTES',
    ]);
  });

  it('el acceso se reemplaza completo: lo desmarcado se borra, y puede tener sucursales de varias empresas (RN-00.5)', async () => {
    const { sucursalA, sucursalB, adminA } = await crearDosSucursales(e2e.dataSource);

    const respuesta = await http()
      .put(`/api/v1/administradores/${adminA.id}/acceso`)
      .set('Cookie', superCookie)
      .send({ permisos: [PERMISOS.CERTIFICADOS_VER, PERMISOS.CERTIFICADOS_VER], sucursalIds: [sucursalB.id, sucursalA.id] })
      .expect(200);
    expect(respuesta.body.permisos).toEqual([PERMISOS.CERTIFICADOS_VER]);
    expect(respuesta.body.sucursales.map((s: { id: string }) => s.id).sort()).toEqual([sucursalA.id, sucursalB.id].sort());

    const vacio = await http()
      .put(`/api/v1/administradores/${adminA.id}/acceso`)
      .set('Cookie', superCookie)
      .send({ permisos: [], sucursalIds: [] })
      .expect(200);
    expect(vacio.body).toMatchObject({ permisos: [], sucursales: [] });
  });

  it('valida el acceso: permisos del catálogo y sucursales que existan', async () => {
    const admin = await crearAdministrador(e2e.dataSource);
    await http()
      .put(`/api/v1/administradores/${admin.id}/acceso`)
      .set('Cookie', superCookie)
      .send({ permisos: ['HACER_TODO'], sucursalIds: [] })
      .expect(400);
    const inexistente = await http()
      .put(`/api/v1/administradores/${admin.id}/acceso`)
      .set('Cookie', superCookie)
      .send({ permisos: [], sucursalIds: ['00000000-0000-4000-8000-000000000000'] })
      .expect(422);
    expect(inexistente.body.code).toBe('SUCURSAL_NO_ENCONTRADA');
  });

  it('el usuario es único en toda la plataforma (RN-01.1)', async () => {
    await crearAdministrador(e2e.dataSource, { username: 'jperez' });
    const respuesta = await http()
      .post('/api/v1/administradores')
      .set('Cookie', superCookie)
      .send({ ...NUEVO_ADMIN, username: 'JPEREZ' })
      .expect(409);
    expect(respuesta.body.code).toBe('USUARIO_USERNAME_DUPLICADO');
  });

  it('lista administradores con búsqueda, estado y cuántos permisos y sucursales tienen', async () => {
    const { adminA } = await crearDosSucursales(e2e.dataSource);
    await e2e.dataSource.query(`UPDATE usuarios SET nombres = 'Laura', activo = false WHERE id = $1`, [adminA.id]);

    const lista = await http().get('/api/v1/administradores?search=laura').set('Cookie', superCookie).expect(200);
    expect(lista.body.meta.total).toBe(1);
    expect(lista.body.data[0]).toMatchObject({ id: adminA.id, totalPermisos: TODOS_LOS_PERMISOS.length, totalSucursales: 1 });

    const activos = await http().get('/api/v1/administradores?activo=true').set('Cookie', superCookie).expect(200);
    expect(activos.body.meta.total).toBe(1);
  });

  it('edita, restablece la contraseña, desactiva y reactiva; ya no exige un administrador por empresa', async () => {
    const { adminA } = await crearDosSucursales(e2e.dataSource);
    const cookieAdmin = await iniciarSesion(e2e.app, adminA.username);

    const editado = await http()
      .patch(`/api/v1/administradores/${adminA.id}`)
      .set('Cookie', superCookie)
      .send({ nombres: 'Ana María', apellidoMaterno: 'Luna' })
      .expect(200);
    expect(editado.body).toMatchObject({ nombres: 'Ana María', apellidoMaterno: 'Luna' });

    await http().post(`/api/v1/usuarios/${adminA.id}/restablecer-password`).set('Cookie', superCookie).send({ passwordTemporal: 'Reinicio2026' }).expect(200);
    await http().get('/api/v1/perfil').set('Cookie', cookieAdmin).expect(401);

    await http().post(`/api/v1/usuarios/${adminA.id}/desactivar`).set('Cookie', superCookie).expect(200);
    await http().post('/api/v1/auth/login').send({ username: adminA.username, password: 'Reinicio2026' }).expect(401);
    await http().post(`/api/v1/usuarios/${adminA.id}/activar`).set('Cookie', superCookie).expect(200);
    await iniciarSesion(e2e.app, adminA.username, 'Reinicio2026');
  });

  it('/administradores/:id responde 404 si el usuario no es administrador', async () => {
    const { sucursalA } = await crearDosSucursales(e2e.dataSource);
    const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
    await http().get(`/api/v1/administradores/${empleado.id}`).set('Cookie', superCookie).expect(404);
    await http().put(`/api/v1/administradores/${empleado.id}/acceso`).set('Cookie', superCookie).send({ permisos: [], sucursalIds: [] }).expect(404);
  });

  describe('Permisos y alcance sobre cuentas de empleados', () => {
    it('restablecer contraseñas y activar empleados exige el permiso y que el empleado sea de sus sucursales', async () => {
      const { sucursalA, sucursalB } = await crearDosSucursales(e2e.dataSource);
      const propio = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const ajeno = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalB.id });
      const conPassword = await crearAdministrador(e2e.dataSource, {
        permisos: [PERMISOS.EMPLEADOS_RESTABLECER_PASSWORD],
        sucursalIds: [sucursalA.id],
      });
      const cookie = await iniciarSesion(e2e.app, conPassword.username);
      const enviar = (id: string) =>
        http().post(`/api/v1/usuarios/${id}/restablecer-password`).set('Cookie', cookie).send({ passwordTemporal: 'Reinicio2026' });

      await enviar(propio.id).expect(200);
      await enviar(ajeno.id).expect(404);
      // Tiene el permiso de contrasenas, pero no el de gestionar empleados
      await http().post(`/api/v1/usuarios/${propio.id}/desactivar`).set('Cookie', cookie).expect(403);
    });

    it('al quitarle una sucursal, la siguiente petición sobre sus empleados ya responde 404', async () => {
      const { sucursalA, adminA } = await crearDosSucursales(e2e.dataSource);
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const cookieA = await iniciarSesion(e2e.app, adminA.username);
      await http().post(`/api/v1/usuarios/${empleado.id}/desbloquear`).set('Cookie', cookieA).expect(200);

      await http().put(`/api/v1/administradores/${adminA.id}/acceso`).set('Cookie', superCookie).send({ permisos: TODOS_LOS_PERMISOS, sucursalIds: [] }).expect(200);
      await http().post(`/api/v1/usuarios/${empleado.id}/desbloquear`).set('Cookie', cookieA).expect(404);
    });

    it('una sucursal desactivada sale de su alcance', async () => {
      const { sucursalA, adminA, empresaA } = await crearDosSucursales(e2e.dataSource);
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const otra = await crearSucursal(e2e.dataSource, { empresaId: empresaA.id });
      await e2e.dataSource.query(`INSERT INTO administradores_sucursales (usuario_id, sucursal_id, creado_por)
                                  SELECT $1, $2, id FROM usuarios WHERE rol = 'SUPERUSUARIO'`, [adminA.id, otra.id]);
      const cookieA = await iniciarSesion(e2e.app, adminA.username);

      await http().post(`/api/v1/sucursales/${sucursalA.id}/desactivar`).set('Cookie', superCookie).expect(200);
      await http().post(`/api/v1/usuarios/${empleado.id}/desbloquear`).set('Cookie', cookieA).expect(404);
      const me = await http().get('/api/v1/auth/me').set('Cookie', cookieA).expect(200);
      expect(me.body.sucursales.map((s: { id: string }) => s.id)).toEqual([otra.id]);
    });

    it('un administrador no gestiona administradores ni su propio acceso, aunque tenga todos los permisos (P-49)', async () => {
      const { adminA, adminB, sucursalA } = await crearDosSucursales(e2e.dataSource);
      const cookieA = await iniciarSesion(e2e.app, adminA.username);

      await http().get('/api/v1/administradores').set('Cookie', cookieA).expect(403);
      await http().put(`/api/v1/administradores/${adminA.id}/acceso`).set('Cookie', cookieA).send({ permisos: [], sucursalIds: [sucursalA.id] }).expect(403);
      for (const objetivo of [adminB]) {
        await http().post(`/api/v1/usuarios/${objetivo.id}/restablecer-password`).set('Cookie', cookieA).send({ passwordTemporal: 'Reinicio2026' }).expect(404);
        await http().post(`/api/v1/usuarios/${objetivo.id}/desactivar`).set('Cookie', cookieA).expect(404);
      }
    });

    it('el superusuario gestiona cuentas de empleados de cualquier sucursal (P-48), pero no la suya (RN-00.7)', async () => {
      const { sucursalB } = await crearDosSucursales(e2e.dataSource);
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalB.id });
      const desactivado = await http().post(`/api/v1/usuarios/${empleado.id}/desactivar`).set('Cookie', superCookie).expect(200);
      expect(desactivado.body.activo).toBe(false);

      const superusuario = await obtenerSuperusuario(e2e.dataSource);
      await http().post(`/api/v1/usuarios/${superusuario.id}/desactivar`).set('Cookie', superCookie).expect(404);
    });
  });
});
