import request from 'supertest';
import { PERMISOS } from '../src/common/constants/permisos.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import {
  crearAdministrador,
  crearArea,
  crearDosSucursales,
  crearEmpleado,
  crearPuesto,
  obtenerSuperusuario,
} from './e2e/fabricas.js';
import { iniciarSesion, iniciarSesionEmpleado } from './e2e/sesion.js';

describe('Catálogo de áreas y puestos (HU-07, HU-08)', () => {
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

  it('el superusuario crea un área y sus puestos, y los edita (RF-02.1, RF-02.2)', async () => {
    const area = await http()
      .post('/api/v1/areas')
      .set('Cookie', superCookie)
      .send({ nombre: ' Servicio ', descripcion: 'Taller y recepción' })
      .expect(201);
    expect(area.body).toMatchObject({
      nombre: 'Servicio',
      activo: true,
      puestos: 0,
      uso: { empleados: 0, sucursales: 0, empresas: 0 },
      creadoPor: 'Superusuario Pruebas',
      actualizadoPor: null,
    });

    const puesto = await http()
      .post('/api/v1/puestos')
      .set('Cookie', superCookie)
      .send({ areaId: area.body.id, nombre: 'Asesor de servicio' })
      .expect(201);
    expect(puesto.body).toMatchObject({ nombre: 'Asesor de servicio', area: { id: area.body.id, nombre: 'Servicio', activo: true } });

    const editado = await http()
      .patch(`/api/v1/puestos/${puesto.body.id}`)
      .set('Cookie', superCookie)
      .send({ nombre: 'Asesor de servicio senior', descripcion: '' })
      .expect(200);
    expect(editado.body).toMatchObject({ nombre: 'Asesor de servicio senior', descripcion: null, actualizadoPor: 'Superusuario Pruebas' });

    const lista = await http().get(`/api/v1/puestos?areaId=${area.body.id}`).set('Cookie', superCookie).expect(200);
    expect(lista.body).toHaveLength(1);
  });

  it('responde 409 si el nombre se repite: el área en la plataforma y el puesto en su área (RN-02.1)', async () => {
    const area = await crearArea(e2e.dataSource, { nombre: 'Ventas' });
    await crearPuesto(e2e.dataSource, { areaId: area.id, nombre: 'Vendedor' });

    const areaRepetida = await http().post('/api/v1/areas').set('Cookie', superCookie).send({ nombre: 'VENTAS' }).expect(409);
    expect(areaRepetida.body.code).toBe('AREA_NOMBRE_DUPLICADO');
    const puestoRepetido = await http()
      .post('/api/v1/puestos')
      .set('Cookie', superCookie)
      .send({ areaId: area.id, nombre: 'vendedor' })
      .expect(409);
    expect(puestoRepetido.body.code).toBe('PUESTO_NOMBRE_DUPLICADO');
  });

  it('cuenta los empleados activos, sucursales y empresas que usan cada área y puesto (RN-02.6)', async () => {
    const { sucursalA, sucursalB } = await crearDosSucursales(e2e.dataSource);
    const puesto = await crearPuesto(e2e.dataSource);
    await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, puestoId: puesto.id });
    await crearEmpleado(e2e.dataSource, { sucursalId: sucursalB.id, puestoId: puesto.id });
    const inactivo = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, puestoId: puesto.id });
    await e2e.dataSource.query('UPDATE usuarios SET activo = false WHERE id = $1', [inactivo.id]);

    const respuesta = await http().get(`/api/v1/puestos/${puesto.id}`).set('Cookie', superCookie).expect(200);
    expect(respuesta.body.uso).toEqual({ empleados: 2, sucursales: 2, empresas: 2 });
    const area = await http().get(`/api/v1/areas/${puesto.areaId}`).set('Cookie', superCookie).expect(200);
    expect(area.body).toMatchObject({ puestos: 1, puestosActivos: 1, uso: { empleados: 2, sucursales: 2, empresas: 2 } });
  });

  it('no desactiva un puesto con empleados activos ni un área con puestos activos (RN-02.3, RN-02.4)', async () => {
    const { sucursalA } = await crearDosSucursales(e2e.dataSource);
    const puesto = await crearPuesto(e2e.dataSource);
    const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id, puestoId: puesto.id });

    const conEmpleados = await http().post(`/api/v1/puestos/${puesto.id}/desactivar`).set('Cookie', superCookie).expect(409);
    expect(conEmpleados.body.code).toBe('PUESTO_CON_EMPLEADOS');
    const conPuestos = await http().post(`/api/v1/areas/${puesto.areaId}/desactivar`).set('Cookie', superCookie).expect(409);
    expect(conPuestos.body.code).toBe('AREA_CON_PUESTOS_ACTIVOS');

    // Con el empleado dado de baja ya se puede: primero el puesto, luego el area
    await e2e.dataSource.query('UPDATE usuarios SET activo = false WHERE id = $1', [empleado.id]);
    await http().post(`/api/v1/puestos/${puesto.id}/desactivar`).set('Cookie', superCookie).expect(200);
    const area = await http().post(`/api/v1/areas/${puesto.areaId}/desactivar`).set('Cookie', superCookie).expect(200);
    expect(area.body.activo).toBe(false);
  });

  it('no crea ni activa puestos en un área desactivada', async () => {
    const area = await crearArea(e2e.dataSource, { activo: false });
    const puesto = await crearPuesto(e2e.dataSource, { areaId: area.id, activo: false });

    const nuevo = await http().post('/api/v1/puestos').set('Cookie', superCookie).send({ areaId: area.id, nombre: 'Cajero' }).expect(422);
    expect(nuevo.body.code).toBe('AREA_INACTIVA');
    const activar = await http().post(`/api/v1/puestos/${puesto.id}/activar`).set('Cookie', superCookie).expect(422);
    expect(activar.body.code).toBe('AREA_INACTIVA');
  });

  it('un administrador con CATALOGO_GESTIONAR edita el catálogo; sin él solo lo consulta (403)', async () => {
    const { sucursalA } = await crearDosSucursales(e2e.dataSource);
    const conPermiso = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.CATALOGO_GESTIONAR], sucursalIds: [sucursalA.id] });
    const sinPermiso = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.EMPLEADOS_VER], sucursalIds: [sucursalA.id] });
    const cookieCon = await iniciarSesion(e2e.app, conPermiso.username);
    const cookieSin = await iniciarSesion(e2e.app, sinPermiso.username);

    await http().post('/api/v1/areas').set('Cookie', cookieCon).send({ nombre: 'Refacciones' }).expect(201);

    await http().get('/api/v1/areas').set('Cookie', cookieSin).expect(200);
    await http().get('/api/v1/puestos').set('Cookie', cookieSin).expect(200);
    const sin = await http().post('/api/v1/areas').set('Cookie', cookieSin).send({ nombre: 'Seminuevos' }).expect(403);
    expect(sin.body.code).toBe('SIN_PERMISO');
  });

  it('un empleado no consulta el catálogo', async () => {
    const { sucursalA } = await crearDosSucursales(e2e.dataSource);
    const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
    const cookie = await iniciarSesionEmpleado(e2e.app, empleado);
    await http().get('/api/v1/areas').set('Cookie', cookie).expect(403);
  });
});
