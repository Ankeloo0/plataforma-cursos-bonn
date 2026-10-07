import sharp from 'sharp';
import request from 'supertest';
import { PERMISOS } from '../src/common/constants/permisos.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import {
  crearAdministrador,
  crearDosSucursales,
  crearEmpleado,
  crearPuesto,
  crearSucursal,
  obtenerSuperusuario,
  PASSWORD_PRUEBA,
} from './e2e/fabricas.js';
import { iniciarSesion, iniciarSesionEmpleado } from './e2e/sesion.js';

describe('Empleados (HU-09 a HU-13)', () => {
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

  // Dos empresas con una sucursal cada una; adminA opera solo la sucursal A
  async function escenario() {
    const base = await crearDosSucursales(e2e.dataSource);
    const puesto = await crearPuesto(e2e.dataSource, { nombre: 'Asesor de servicio' });
    const cookieA = await iniciarSesion(e2e.app, base.adminA.username);
    return { ...base, puesto, cookieA };
  }

  function datosAlta(sucursalId: string, puestoId: string, cambios: Record<string, unknown> = {}) {
    return {
      sucursalId,
      puestoId,
      nombres: 'Ana',
      apellidoPaterno: 'Ruiz',
      numeroEmpleado: '1024',
      fechaIngreso: '2026-03-01',
      passwordTemporal: 'Temporal2026',
      ...cambios,
    };
  }

  describe('Alta (HU-09)', () => {
    it('crea la cuenta sin usuario y los datos laborales; el empleado entra con su empresa y su número (RF-03.1, D-34)', async () => {
      const { sucursalA, empresaA, adminA, puesto, cookieA } = await escenario();

      const creado = await http().post('/api/v1/empleados').set('Cookie', cookieA).send(datosAlta(sucursalA.id, puesto.id)).expect(201);
      expect(creado.body).toMatchObject({
        numeroEmpleado: '1024',
        fechaIngreso: '2026-03-01',
        nombres: 'Ana',
        activo: true,
        debeCambiarPassword: true,
        puesto: { id: puesto.id, nombre: 'Asesor de servicio' },
        area: { id: puesto.areaId },
        sucursal: { id: sucursalA.id },
        empresa: { id: empresaA.id },
        creadoPor: `${adminA.username} Usuario Pruebas`,
        actualizadoPor: null,
      });
      expect(JSON.stringify(creado.body)).not.toMatch(/passwordHash|password_hash|passwordTemporal|Temporal2026/i);

      const [usuario] = await e2e.dataSource.query('SELECT username, rol FROM usuarios WHERE id = $1', [creado.body.usuarioId]);
      expect(usuario).toEqual({ username: null, rol: 'EMPLEADO' });

      const login = await http()
        .post('/api/v1/auth/login-empleado')
        .send({ empresaId: empresaA.id, numeroEmpleado: '1024', password: 'Temporal2026' })
        .expect(200);
      expect(login.body).toMatchObject({ rol: 'EMPLEADO', debeCambiarPassword: true });
    });

    it('rechaza un número repetido en la empresa (409) sin dejar una cuenta a medias; otra empresa sí puede usarlo', async () => {
      const { sucursalA, sucursalB, puesto } = await escenario();
      const otraDeA = await crearSucursal(e2e.dataSource, { empresaId: sucursalA.empresaId });
      await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, numeroEmpleado: 'VW-1' });
      const [{ antes }] = await e2e.dataSource.query(`SELECT count(*)::int AS antes FROM usuarios`);

      const repetido = await http()
        .post('/api/v1/empleados')
        .set('Cookie', superCookie)
        .send(datosAlta(otraDeA.id, puesto.id, { numeroEmpleado: 'vw-1' }))
        .expect(409);
      expect(repetido.body.code).toBe('EMPLEADO_NUMERO_DUPLICADO');
      const [{ despues }] = await e2e.dataSource.query(`SELECT count(*)::int AS despues FROM usuarios`);
      expect(despues).toBe(antes);

      await http().post('/api/v1/empleados').set('Cookie', superCookie).send(datosAlta(sucursalB.id, puesto.id, { numeroEmpleado: 'VW-1' })).expect(201);
    });

    it('un administrador no da de alta en una sucursal fuera de su alcance (404) ni con un puesto inactivo (422)', async () => {
      const { sucursalA, sucursalB, cookieA } = await escenario();
      const inactivo = await crearPuesto(e2e.dataSource, { activo: false });
      const activo = await crearPuesto(e2e.dataSource);

      const ajena = await http().post('/api/v1/empleados').set('Cookie', cookieA).send(datosAlta(sucursalB.id, activo.id)).expect(404);
      expect(ajena.body.code).toBe('SUCURSAL_NO_ENCONTRADA');
      const puesto = await http().post('/api/v1/empleados').set('Cookie', cookieA).send(datosAlta(sucursalA.id, inactivo.id)).expect(422);
      expect(puesto.body.code).toBe('PUESTO_INACTIVO');
    });

    it('valida los datos y rechaza campos que no existen, como username o creadoPor', async () => {
      const { sucursalA, puesto, cookieA } = await escenario();
      const enviar = (cambios: Record<string, unknown>) =>
        http().post('/api/v1/empleados').set('Cookie', cookieA).send(datosAlta(sucursalA.id, puesto.id, cambios));

      await enviar({ username: 'aruiz' }).expect(400);
      await enviar({ creadoPor: sucursalA.id }).expect(400);
      await enviar({ fechaIngreso: '2026-02-30' }).expect(400);
      await enviar({ numeroEmpleado: 'número con espacios' }).expect(400);
      await enviar({ passwordTemporal: 'corta' }).expect(400);
    });
  });

  describe('Listado y ficha (HU-10, HU-11)', () => {
    it('cada administrador ve solo los empleados de sus sucursales; el superusuario ve todos (RF-03.5)', async () => {
      const { sucursalA, sucursalB, cookieA } = await escenario();
      const propio = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, numeroEmpleado: 'A-1' });
      const ajeno = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalB.id, numeroEmpleado: 'B-1' });

      const lista = await http().get('/api/v1/empleados').set('Cookie', cookieA).expect(200);
      expect(lista.body.data.map((e: { id: string }) => e.id)).toEqual([propio.empleadoId]);
      expect(lista.body.meta).toMatchObject({ total: 1, page: 1 });

      // Pedir la sucursal ajena como filtro no la agrega al alcance
      const filtrada = await http().get(`/api/v1/empleados?sucursalId=${sucursalB.id}`).set('Cookie', cookieA).expect(200);
      expect(filtrada.body.data).toEqual([]);

      const todos = await http().get('/api/v1/empleados').set('Cookie', superCookie).expect(200);
      expect(todos.body.meta.total).toBe(2);

      await http().get(`/api/v1/empleados/${ajeno.empleadoId}`).set('Cookie', cookieA).expect(404);
      await http().patch(`/api/v1/empleados/${ajeno.empleadoId}`).set('Cookie', cookieA).send({ nombres: 'X' }).expect(404);
      await http().get(`/api/v1/empleados/${propio.empleadoId}`).set('Cookie', cookieA).expect(200);
    });

    it('busca por nombre o número y filtra por puesto, área y estado', async () => {
      const { sucursalA } = await escenario();
      const puesto = await crearPuesto(e2e.dataSource);
      const buscado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, numeroEmpleado: 'X-77', puestoId: puesto.id });
      const inactivo = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      await e2e.dataSource.query('UPDATE usuarios SET activo = false WHERE id = $1', [inactivo.id]);

      const ids = async (query: string) =>
        (await http().get(`/api/v1/empleados?${query}`).set('Cookie', superCookie).expect(200)).body.data.map((e: { id: string }) => e.id);

      expect(await ids('search=x-77')).toEqual([buscado.empleadoId]);
      expect(await ids(`puestoId=${puesto.id}`)).toEqual([buscado.empleadoId]);
      expect(await ids(`areaId=${puesto.areaId}`)).toEqual([buscado.empleadoId]);
      expect(await ids('activo=false')).toEqual([inactivo.empleadoId]);
    });

    it('un administrador con solo EMPLEADOS_VER consulta, pero no da de alta ni edita (403)', async () => {
      const { sucursalA, puesto } = await escenario();
      const lector = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.EMPLEADOS_VER], sucursalIds: [sucursalA.id] });
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const cookie = await iniciarSesion(e2e.app, lector.username);

      await http().get('/api/v1/empleados').set('Cookie', cookie).expect(200);
      await http().post('/api/v1/empleados').set('Cookie', cookie).send(datosAlta(sucursalA.id, puesto.id)).expect(403);
      await http().patch(`/api/v1/empleados/${empleado.empleadoId}`).set('Cookie', cookie).send({ nombres: 'X' }).expect(403);
    });
  });

  describe('Edición y traslado (HU-10)', () => {
    it('edita datos, número y puesto, y registra quién lo modificó (RF-03.3, RF-03.6)', async () => {
      const { sucursalA, adminA, cookieA } = await escenario();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const nuevoPuesto = await crearPuesto(e2e.dataSource, { nombre: 'Jefe de taller' });

      const editado = await http()
        .patch(`/api/v1/empleados/${empleado.empleadoId}`)
        .set('Cookie', cookieA)
        .send({ nombres: 'Luis', apellidoMaterno: '', numeroEmpleado: 'A-500', puestoId: nuevoPuesto.id })
        .expect(200);
      expect(editado.body).toMatchObject({
        nombres: 'Luis',
        apellidoMaterno: null,
        numeroEmpleado: 'A-500',
        puesto: { id: nuevoPuesto.id, nombre: 'Jefe de taller' },
        actualizadoPor: `${adminA.username} Usuario Pruebas`,
      });
    });

    it('traslada a otra sucursal de la misma empresa; a otra empresa no (RF-03.3, RN-03.5, V-03)', async () => {
      const { sucursalA, sucursalB } = await escenario();
      const otraDeA = await crearSucursal(e2e.dataSource, { empresaId: sucursalA.empresaId });
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });

      const trasladado = await http()
        .patch(`/api/v1/empleados/${empleado.empleadoId}`)
        .set('Cookie', superCookie)
        .send({ sucursalId: otraDeA.id })
        .expect(200);
      expect(trasladado.body.sucursal.id).toBe(otraDeA.id);

      const otraEmpresa = await http()
        .patch(`/api/v1/empleados/${empleado.empleadoId}`)
        .set('Cookie', superCookie)
        .send({ sucursalId: sucursalB.id })
        .expect(422);
      expect(otraEmpresa.body.code).toBe('TRASLADO_OTRA_EMPRESA');
    });

    it('un administrador no traslada a una sucursal fuera de su alcance, aunque sea de la misma empresa (404)', async () => {
      const { sucursalA, cookieA } = await escenario();
      const otraDeA = await crearSucursal(e2e.dataSource, { empresaId: sucursalA.empresaId });
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });

      await http().patch(`/api/v1/empleados/${empleado.empleadoId}`).set('Cookie', cookieA).send({ sucursalId: otraDeA.id }).expect(404);
    });

    it('no repite un número de la empresa al editar (409)', async () => {
      const { sucursalA } = await escenario();
      await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, numeroEmpleado: 'A-1' });
      const otro = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, numeroEmpleado: 'A-2' });

      const respuesta = await http()
        .patch(`/api/v1/empleados/${otro.empleadoId}`)
        .set('Cookie', superCookie)
        .send({ numeroEmpleado: 'a-1' })
        .expect(409);
      expect(respuesta.body.code).toBe('EMPLEADO_NUMERO_DUPLICADO');
    });
  });

  describe('Cuenta del empleado (HU-10, HU-12)', () => {
    it('al darlo de baja ya no entra; al restablecer su contraseña debe cambiarla (RF-03.4, RF-01.4)', async () => {
      const { sucursalA, cookieA } = await escenario();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const credenciales = { empresaId: empleado.empresaId, numeroEmpleado: empleado.numeroEmpleado };

      await http().post(`/api/v1/usuarios/${empleado.id}/restablecer-password`).set('Cookie', cookieA).send({ passwordTemporal: 'Reinicio2026' }).expect(200);
      const login = await http().post('/api/v1/auth/login-empleado').send({ ...credenciales, password: 'Reinicio2026' }).expect(200);
      expect(login.body.debeCambiarPassword).toBe(true);

      await http().post(`/api/v1/usuarios/${empleado.id}/desactivar`).set('Cookie', cookieA).expect(200);
      await http().post('/api/v1/auth/login-empleado').send({ ...credenciales, password: 'Reinicio2026' }).expect(401);
      const ficha = await http().get(`/api/v1/empleados/${empleado.empleadoId}`).set('Cookie', cookieA).expect(200);
      expect(ficha.body.activo).toBe(false);
    });

    it('el administrador cambia y quita la foto de un empleado de su sucursal (RF-01.8)', async () => {
      const { sucursalA, sucursalB, cookieA } = await escenario();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const ajeno = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalB.id });
      const foto = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#225380' } }).png().toBuffer();

      const conFoto = await http().put(`/api/v1/empleados/${empleado.empleadoId}/foto`).set('Cookie', cookieA).attach('foto', foto, 'a.png').expect(200);
      expect(conFoto.body.fotoUrl).toMatch(/^\/api\/v1\/archivos\//);
      await http().put(`/api/v1/empleados/${ajeno.empleadoId}/foto`).set('Cookie', cookieA).attach('foto', foto, 'a.png').expect(404);

      const sinFoto = await http().delete(`/api/v1/empleados/${empleado.empleadoId}/foto`).set('Cookie', cookieA).expect(200);
      expect(sinFoto.body.fotoUrl).toBeNull();
    });
  });

  describe('Panel del empleado (HU-13)', () => {
    it('el empleado entra y ve su sesión, pero no las rutas de administración', async () => {
      const { sucursalA } = await escenario();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const cookie = await iniciarSesionEmpleado(e2e.app, empleado);

      const me = await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body).toMatchObject({ rol: 'EMPLEADO', sucursal: { id: sucursalA.id }, empleado: { numeroEmpleado: empleado.numeroEmpleado } });
      await http().get('/api/v1/empleados').set('Cookie', cookie).expect(403);
    });

    it('con contraseña temporal, el empleado solo puede cambiarla', async () => {
      const { sucursalA } = await escenario();
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, debeCambiarPassword: true });
      const cookie = await iniciarSesionEmpleado(e2e.app, empleado);

      await http().get('/api/v1/perfil').set('Cookie', cookie).expect(403);
      await http()
        .post('/api/v1/auth/cambiar-password')
        .set('Cookie', cookie)
        .send({ passwordActual: PASSWORD_PRUEBA, passwordNueva: 'MiClave2026' })
        .expect(200);
    });
  });
});
