import request from 'supertest';
import { PERMISOS } from '../src/common/constants/permisos.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import {
  crearAdministrador,
  crearDosSucursales,
  crearEmpleado,
  crearEmpresa,
  crearMarca,
  PASSWORD_PRUEBA,
  crearSucursal,
  obtenerSuperusuario,
} from './e2e/fabricas.js';
import { iniciarSesion, iniciarSesionEmpleado } from './e2e/sesion.js';

describe('Empresas y sucursales (HU-04, HU-46)', () => {
  let e2e: AppE2e;
  let superCookie: string;
  const http = () => request(e2e.app.getHttpServer());

  beforeAll(async () => {
    e2e = await crearAppE2e();
  });

  beforeEach(async () => {
    await limpiarBase(e2e.dataSource);
    const superusuario = await obtenerSuperusuario(e2e.dataSource);
    superCookie = await iniciarSesion(e2e.app, superusuario.username);
  });

  afterAll(async () => {
    await limpiarBase(e2e.dataSource);
    await e2e.app.close();
  });

  describe('Empresas', () => {
    it('crea una empresa con su prefijo de folio en mayúsculas (RF-00.1, D-30)', async () => {
      const respuesta = await http()
        .post('/api/v1/empresas')
        .set('Cookie', superCookie)
        .send({ nombre: '  Grupo Bonn  ', razonSocial: 'Automotriz Bonn S.A. de C.V.', prefijoFolio: ' gb ' })
        .expect(201);
      expect(respuesta.body).toMatchObject({
        nombre: 'Grupo Bonn',
        prefijoFolio: 'GB',
        activo: true,
        sucursalesActivas: 0,
        administradores: 0,
        creadoPor: 'Superusuario Pruebas',
      });
    });

    it('valida el prefijo y lo trata como único (RN-00.6)', async () => {
      await http().post('/api/v1/empresas').set('Cookie', superCookie).send({ nombre: 'Sin prefijo' }).expect(400);
      await http().post('/api/v1/empresas').set('Cookie', superCookie).send({ nombre: 'Corto', prefijoFolio: 'G' }).expect(400);

      await crearEmpresa(e2e.dataSource, { prefijoFolio: 'GB' });
      const duplicado = await http()
        .post('/api/v1/empresas')
        .set('Cookie', superCookie)
        .send({ nombre: 'Otra', prefijoFolio: 'GB' })
        .expect(409);
      expect(duplicado.body.code).toBe('EMPRESA_PREFIJO_DUPLICADO');
    });

    it('el nombre es único sin distinguir mayúsculas (RN-00.6)', async () => {
      await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Norte' });
      const respuesta = await http()
        .post('/api/v1/empresas')
        .set('Cookie', superCookie)
        .send({ nombre: 'GRUPO NORTE', prefijoFolio: 'GN' })
        .expect(409);
      expect(respuesta.body.code).toBe('EMPRESA_NOMBRE_DUPLICADO');
    });

    it('lista con búsqueda, filtro por estado y paginación', async () => {
      await crearEmpresa(e2e.dataSource, { nombre: 'Bonn Oaxaca' });
      await crearEmpresa(e2e.dataSource, { nombre: 'Bonn Puebla', activo: false });
      await crearEmpresa(e2e.dataSource, { nombre: 'Otra 100%' });

      const busqueda = await http().get('/api/v1/empresas?search=bonn').set('Cookie', superCookie).expect(200);
      expect(busqueda.body.data.map((e: { nombre: string }) => e.nombre)).toEqual(['Bonn Oaxaca', 'Bonn Puebla']);

      const activas = await http().get('/api/v1/empresas?search=bonn&activo=true').set('Cookie', superCookie).expect(200);
      expect(activas.body.meta.total).toBe(1);

      const comodin = await http().get('/api/v1/empresas?search=%25').set('Cookie', superCookie).expect(200);
      expect(comodin.body.data.map((e: { nombre: string }) => e.nombre)).toEqual(['Otra 100%']);

      const pagina = await http().get('/api/v1/empresas?limit=2&page=2').set('Cookie', superCookie).expect(200);
      expect(pagina.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });

    it('cuenta sus sucursales activas, sus administradores y sus empleados (RF-00.4)', async () => {
      const { empresaA, sucursalA } = await crearDosSucursales(e2e.dataSource);
      await crearSucursal(e2e.dataSource, { empresaId: empresaA.id, activo: false });
      await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });

      const respuesta = await http().get(`/api/v1/empresas/${empresaA.id}`).set('Cookie', superCookie).expect(200);
      expect(respuesta.body).toMatchObject({ sucursalesActivas: 1, administradores: 1, empleadosActivos: 1 });
    });

    it('edita, desactiva y reactiva, registrando quién modificó (RNF-17)', async () => {
      const empresa = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Sur' });

      const editada = await http()
        .patch(`/api/v1/empresas/${empresa.id}`)
        .set('Cookie', superCookie)
        .send({ razonSocial: 'Sur S.A.', prefijoFolio: 'sur' })
        .expect(200);
      expect(editada.body).toMatchObject({ razonSocial: 'Sur S.A.', prefijoFolio: 'SUR', actualizadoPor: 'Superusuario Pruebas' });

      await http().post(`/api/v1/empresas/${empresa.id}/desactivar`).set('Cookie', superCookie).expect(200);
      const reactivada = await http().post(`/api/v1/empresas/${empresa.id}/activar`).set('Cookie', superCookie).expect(200);
      expect(reactivada.body.activo).toBe(true);
    });

    it('al desactivarla, sus sucursales salen del alcance de los administradores (RN-00.3)', async () => {
      const { empresaA, adminA } = await crearDosSucursales(e2e.dataSource);
      const cookieAdmin = await iniciarSesion(e2e.app, adminA.username);

      await http().post(`/api/v1/empresas/${empresaA.id}/desactivar`).set('Cookie', superCookie).expect(200);

      const sucursales = await http().get('/api/v1/sucursales').set('Cookie', cookieAdmin).expect(200);
      expect(sucursales.body).toEqual([]);
    });

    it('al desactivar la empresa, sus empleados no entran y se cierran sus sesiones (RN-00.3)', async () => {
      const { empresaA, sucursalA } = await crearDosSucursales(e2e.dataSource);
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const cookieEmpleado = await iniciarSesionEmpleado(e2e.app, empleado);

      await http().post(`/api/v1/empresas/${empresaA.id}/desactivar`).set('Cookie', superCookie).expect(200);

      await http().get('/api/v1/perfil').set('Cookie', cookieEmpleado).expect(401);
      await http()
        .post('/api/v1/auth/login-empleado')
        .send({ empresaId: empleado.empresaId, numeroEmpleado: empleado.numeroEmpleado, password: PASSWORD_PRUEBA })
        .expect(401);
    });

    it('responde 404 para una empresa que no existe, 400 para un id inválido y rechaza campos como creadoPor', async () => {
      await http().get('/api/v1/empresas/00000000-0000-4000-8000-000000000000').set('Cookie', superCookie).expect(404);
      await http().get('/api/v1/empresas/no-es-uuid').set('Cookie', superCookie).expect(400);
      await http()
        .post('/api/v1/empresas')
        .set('Cookie', superCookie)
        .send({ nombre: 'X', prefijoFolio: 'XX', creadoPor: 'otro' })
        .expect(400);
    });
  });

  describe('Sucursales', () => {
    it('crea una sucursal con marca y dirección, y la lista en su empresa (RF-00.6)', async () => {
      const empresa = await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Bonn' });
      const marca = await crearMarca(e2e.dataSource, { nombre: 'Volkswagen' });

      const creada = await http()
        .post(`/api/v1/empresas/${empresa.id}/sucursales`)
        .set('Cookie', superCookie)
        .send({ nombre: 'Volkswagen Bonn Oaxaca', marcaId: marca.id, direccion: 'Av. Universidad 801, Exhacienda Candiani' })
        .expect(201);
      expect(creada.body).toMatchObject({
        nombre: 'Volkswagen Bonn Oaxaca',
        direccion: 'Av. Universidad 801, Exhacienda Candiani',
        empresa: { id: empresa.id, nombre: 'Grupo Bonn' },
        marca: { id: marca.id, nombre: 'Volkswagen' },
        administradores: [],
        empleadosActivos: 0,
      });

      const lista = await http().get(`/api/v1/empresas/${empresa.id}/sucursales`).set('Cookie', superCookie).expect(200);
      expect(lista.body.map((s: { id: string }) => s.id)).toEqual([creada.body.id]);
    });

    it('exige una marca activa (V-09) y un nombre único dentro de la empresa', async () => {
      const empresa = await crearEmpresa(e2e.dataSource);
      const inactiva = await crearMarca(e2e.dataSource, { activo: false });
      const activa = await crearMarca(e2e.dataSource);

      const conInactiva = await http()
        .post(`/api/v1/empresas/${empresa.id}/sucursales`)
        .set('Cookie', superCookie)
        .send({ nombre: 'Centro', marcaId: inactiva.id })
        .expect(422);
      expect(conInactiva.body.code).toBe('MARCA_INACTIVA');

      await crearSucursal(e2e.dataSource, { empresaId: empresa.id, nombre: 'Centro' });
      const duplicada = await http()
        .post(`/api/v1/empresas/${empresa.id}/sucursales`)
        .set('Cookie', superCookie)
        .send({ nombre: 'CENTRO', marcaId: activa.id })
        .expect(409);
      expect(duplicada.body.code).toBe('SUCURSAL_NOMBRE_DUPLICADO');
    });

    it('muestra qué administradores la tienen en su alcance (RF-00.9)', async () => {
      const { sucursalA, adminA } = await crearDosSucursales(e2e.dataSource);
      const respuesta = await http().get(`/api/v1/sucursales/${sucursalA.id}`).set('Cookie', superCookie).expect(200);
      expect(respuesta.body.administradores).toEqual([{ id: adminA.id, nombre: 'Usuario Pruebas' }]);
    });

    it('edita, cambia de marca y desactiva (RN-00.11)', async () => {
      const { sucursalA } = await crearDosSucursales(e2e.dataSource);
      const kia = await crearMarca(e2e.dataSource, { nombre: 'Kia' });

      const editada = await http()
        .patch(`/api/v1/sucursales/${sucursalA.id}`)
        .set('Cookie', superCookie)
        .send({ marcaId: kia.id, direccion: 'Carretera Internacional 1800' })
        .expect(200);
      expect(editada.body).toMatchObject({ marca: { nombre: 'Kia' }, direccion: 'Carretera Internacional 1800' });

      const desactivada = await http().post(`/api/v1/sucursales/${sucursalA.id}/desactivar`).set('Cookie', superCookie).expect(200);
      expect(desactivada.body.activo).toBe(false);
    });

    it('al desactivar una sucursal, sus empleados no entran y se cierran sus sesiones (RN-00.8)', async () => {
      const { sucursalA } = await crearDosSucursales(e2e.dataSource);
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const cookieEmpleado = await iniciarSesionEmpleado(e2e.app, empleado);

      await http().post(`/api/v1/sucursales/${sucursalA.id}/desactivar`).set('Cookie', superCookie).expect(200);

      await http().get('/api/v1/perfil').set('Cookie', cookieEmpleado).expect(401);
      await http()
        .post('/api/v1/auth/login-empleado')
        .send({ empresaId: empleado.empresaId, numeroEmpleado: empleado.numeroEmpleado, password: PASSWORD_PRUEBA })
        .expect(401);
    });

    it('el selector de sucursales: el superusuario ve todas; cada administrador, solo las suyas', async () => {
      const { sucursalA, sucursalB, adminA } = await crearDosSucursales(e2e.dataSource);
      const cookieA = await iniciarSesion(e2e.app, adminA.username);

      const todas = await http().get('/api/v1/sucursales').set('Cookie', superCookie).expect(200);
      expect(todas.body.map((s: { id: string }) => s.id).sort()).toEqual([sucursalA.id, sucursalB.id].sort());

      const suyas = await http().get('/api/v1/sucursales').set('Cookie', cookieA).expect(200);
      expect(suyas.body.map((s: { id: string }) => s.id)).toEqual([sucursalA.id]);
    });

    it('un administrador no crea, edita ni consulta sucursales, aunque tenga todos los permisos', async () => {
      const { empresaA, sucursalA, adminA, marca } = await crearDosSucursales(e2e.dataSource);
      const cookieA = await iniciarSesion(e2e.app, adminA.username);

      await http().post(`/api/v1/empresas/${empresaA.id}/sucursales`).set('Cookie', cookieA).send({ nombre: 'X', marcaId: marca.id }).expect(403);
      await http().patch(`/api/v1/sucursales/${sucursalA.id}`).set('Cookie', cookieA).send({ nombre: 'X' }).expect(403);
      await http().get(`/api/v1/empresas/${empresaA.id}`).set('Cookie', cookieA).expect(403);
    });

    it('un administrador sin ningún permiso no usa el selector de sucursales', async () => {
      const admin = await crearAdministrador(e2e.dataSource);
      const cookie = await iniciarSesion(e2e.app, admin.username);
      await http().get('/api/v1/sucursales').set('Cookie', cookie).expect(403);

      const conPermiso = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.REPORTES_VER] });
      const cookieConPermiso = await iniciarSesion(e2e.app, conPermiso.username);
      const vacio = await http().get('/api/v1/sucursales').set('Cookie', cookieConPermiso).expect(200);
      expect(vacio.body).toEqual([]);
    });
  });
});
