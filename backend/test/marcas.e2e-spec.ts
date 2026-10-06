import request from 'supertest';
import { PERMISOS } from '../src/common/constants/permisos.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import { crearAdministrador, crearDosSucursales, crearMarca, obtenerSuperusuario } from './e2e/fabricas.js';
import { iniciarSesion } from './e2e/sesion.js';

describe('Marcas (HU-50)', () => {
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

  it('el superusuario crea y edita una marca con sus instrucciones del asistente (RF-00.7, D-31)', async () => {
    const creada = await http()
      .post('/api/v1/marcas')
      .set('Cookie', superCookie)
      .send({ nombre: ' Volkswagen ', instruccionesAsistente: 'Usa el vocabulario de VW.' })
      .expect(201);
    expect(creada.body).toMatchObject({ nombre: 'Volkswagen', activo: true, sucursales: 0, empresas: 0, logoUrl: null });

    const editada = await http()
      .patch(`/api/v1/marcas/${creada.body.id}`)
      .set('Cookie', superCookie)
      .send({ instruccionesAsistente: '' })
      .expect(200);
    expect(editada.body).toMatchObject({ instruccionesAsistente: null, actualizadoPor: 'Superusuario Pruebas' });
  });

  it('el nombre es único sin distinguir mayúsculas', async () => {
    await crearMarca(e2e.dataSource, { nombre: 'Kia' });
    const respuesta = await http().post('/api/v1/marcas').set('Cookie', superCookie).send({ nombre: 'KIA' }).expect(409);
    expect(respuesta.body.code).toBe('MARCA_NOMBRE_DUPLICADO');
  });

  it('indica a cuántas sucursales y empresas afecta un cambio', async () => {
    const { marca } = await crearDosSucursales(e2e.dataSource);
    const respuesta = await http().get(`/api/v1/marcas/${marca.id}`).set('Cookie', superCookie).expect(200);
    expect(respuesta.body).toMatchObject({ sucursales: 2, empresas: 2 });
  });

  it('desactivarla no bloquea a nadie; se puede reactivar (RN-00.12)', async () => {
    const marca = await crearMarca(e2e.dataSource);
    const desactivada = await http().post(`/api/v1/marcas/${marca.id}/desactivar`).set('Cookie', superCookie).expect(200);
    expect(desactivada.body.activo).toBe(false);
    const lista = await http().get('/api/v1/marcas?activo=false').set('Cookie', superCookie).expect(200);
    expect(lista.body.map((m: { id: string }) => m.id)).toEqual([marca.id]);
    await http().post(`/api/v1/marcas/${marca.id}/activar`).set('Cookie', superCookie).expect(200);
  });

  it('un administrador con "Gestionar marcas" las gestiona; sin el permiso solo las lista', async () => {
    const conPermiso = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.MARCAS_GESTIONAR] });
    const sinPermiso = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.REPORTES_VER] });
    const cookieCon = await iniciarSesion(e2e.app, conPermiso.username);
    const cookieSin = await iniciarSesion(e2e.app, sinPermiso.username);

    const creada = await http().post('/api/v1/marcas').set('Cookie', cookieCon).send({ nombre: 'Seat' }).expect(201);
    expect(creada.body.creadoPor).toBe('Usuario Pruebas');

    await http().get('/api/v1/marcas').set('Cookie', cookieSin).expect(200);
    await http().post('/api/v1/marcas').set('Cookie', cookieSin).send({ nombre: 'Audi' }).expect(403);
    await http().patch(`/api/v1/marcas/${creada.body.id}`).set('Cookie', cookieSin).send({ nombre: 'X' }).expect(403);
    await http().get(`/api/v1/marcas/${creada.body.id}`).set('Cookie', cookieSin).expect(403);
  });
});
