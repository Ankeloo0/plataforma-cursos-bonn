import sharp from 'sharp';
import request from 'supertest';
import { PERMISOS } from '../src/common/constants/permisos.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import { crearAdministrador, crearCurso, crearDosSucursales, crearEmpleado, obtenerSuperusuario } from './e2e/fabricas.js';
import { iniciarSesion, iniciarSesionEmpleado } from './e2e/sesion.js';

const imagen = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#1060a0' } }).jpeg().toBuffer();

describe('Cursos (HU-14, I3.1)', () => {
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

  const datosCurso = (cambios: Record<string, unknown> = {}) => ({
    titulo: 'Atención al cliente en servicio',
    descripcion: 'Cómo recibir al cliente en el taller.',
    esObligatorio: true,
    fechaLimite: '2026-12-15',
    calificacionMinima: 80,
    ...cambios,
  });

  // Administrador con "Gestionar cursos" en la sucursal A
  async function creador() {
    const { sucursalA } = await crearDosSucursales(e2e.dataSource);
    const admin = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.CURSOS_GESTIONAR], sucursalIds: [sucursalA.id] });
    return { admin, cookie: await iniciarSesion(e2e.app, admin.username), sucursalA };
  }

  describe('Crear y ver', () => {
    it('crea un curso en borrador, con duración 0 hasta tener videos y con quién lo creó (RF-04.1, RF-04.10, D-36)', async () => {
      const { admin, cookie } = await creador();

      const creado = await http().post('/api/v1/cursos').set('Cookie', cookie).send(datosCurso()).expect(201);
      expect(creado.body).toMatchObject({
        titulo: 'Atención al cliente en servicio',
        duracionHoras: 0,
        esObligatorio: true,
        fechaLimite: '2026-12-15',
        calificacionMinima: 80,
        estado: 'BORRADOR',
        publicadoEn: null,
        portadaUrl: null,
        puedeEditar: true,
        creadoPor: `${admin.username} Usuario Pruebas`,
        actualizadoPor: null,
      });

      await http().get(`/api/v1/cursos/${creado.body.id}`).set('Cookie', cookie).expect(200);
    });

    it('valida los datos y no acepta el estado, el autor ni la duración desde el cliente', async () => {
      const { cookie } = await creador();
      const enviar = (cambios: Record<string, unknown>) => http().post('/api/v1/cursos').set('Cookie', cookie).send(datosCurso(cambios));

      await enviar({ titulo: '  ' }).expect(400);
      await enviar({ duracionHoras: 2 }).expect(400);
      await enviar({ calificacionMinima: 80.555 }).expect(400);
      await enviar({ calificacionMinima: 101 }).expect(400);
      await enviar({ fechaLimite: '2026-02-30' }).expect(400);
      await enviar({ estado: 'PUBLICADO' }).expect(400);
      await enviar({ creadoPor: 'otro' }).expect(400);
      await enviar({ fechaLimite: null, descripcion: '' }).expect(201);
    });
  });

  describe('Quién ve y quién edita (V-10, V-12)', () => {
    it('un administrador solo ve los cursos que creó; el superusuario ve todos', async () => {
      const { admin, cookie } = await creador();
      const propio = await crearCurso(e2e.dataSource, { creadoPor: admin.id, titulo: 'Propio' });
      const ajeno = await crearCurso(e2e.dataSource, { titulo: 'Del superusuario' });

      const lista = await http().get('/api/v1/cursos').set('Cookie', cookie).expect(200);
      expect(lista.body.data.map((c: { id: string }) => c.id)).toEqual([propio.id]);
      expect(lista.body.meta).toMatchObject({ total: 1, page: 1 });

      const todos = await http().get('/api/v1/cursos').set('Cookie', superCookie).expect(200);
      expect(todos.body.meta.total).toBe(2);

      // Un curso que no puede ver responde 404, como si no existiera
      await http().get(`/api/v1/cursos/${ajeno.id}`).set('Cookie', cookie).expect(404);
      await http()
        .patch(`/api/v1/cursos/${ajeno.id}`)
        .set('Cookie', cookie)
        .send({ titulo: 'X', actualizadoEn: new Date().toISOString() })
        .expect(404);
    });

    it('busca por título y filtra por estado', async () => {
      await crearCurso(e2e.dataSource, { titulo: 'Seguridad e higiene' });
      const publicado = await crearCurso(e2e.dataSource, { titulo: 'Garantías', estado: 'PUBLICADO' });

      const titulos = async (query: string) =>
        (await http().get(`/api/v1/cursos?${query}`).set('Cookie', superCookie).expect(200)).body.data.map((c: { titulo: string }) => c.titulo);

      expect(await titulos('search=higiene')).toEqual(['Seguridad e higiene']);
      expect(await titulos('estado=PUBLICADO')).toEqual([publicado.titulo]);
      await http().get('/api/v1/cursos?estado=OTRO').set('Cookie', superCookie).expect(400);
    });

    it('sin un permiso de cursos responde 403; con solo "Asignar cursos" ve sus cursos pero no los edita', async () => {
      const { sucursalA } = await crearDosSucursales(e2e.dataSource);
      const sinPermiso = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.EMPLEADOS_VER], sucursalIds: [sucursalA.id] });
      const asignador = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.CURSOS_ASIGNAR], sucursalIds: [sucursalA.id] });
      const curso = await crearCurso(e2e.dataSource, { creadoPor: asignador.id });

      const cookieSin = await iniciarSesion(e2e.app, sinPermiso.username);
      await http().get('/api/v1/cursos').set('Cookie', cookieSin).expect(403);
      await http().post('/api/v1/cursos').set('Cookie', cookieSin).send(datosCurso()).expect(403);

      const cookieAsignador = await iniciarSesion(e2e.app, asignador.username);
      const visto = await http().get(`/api/v1/cursos/${curso.id}`).set('Cookie', cookieAsignador).expect(200);
      expect(visto.body.puedeEditar).toBe(false);
      await http()
        .patch(`/api/v1/cursos/${curso.id}`)
        .set('Cookie', cookieAsignador)
        .send({ titulo: 'X', actualizadoEn: visto.body.actualizadoEn })
        .expect(403);
    });

    it('el empleado no entra a cursos de administración', async () => {
      const { sucursalA } = await crearDosSucursales(e2e.dataSource);
      const empleado = await crearEmpleado(e2e.dataSource, { sucursalId: sucursalA.id });
      const cookie = await iniciarSesionEmpleado(e2e.app, empleado);
      await http().get('/api/v1/cursos').set('Cookie', cookie).expect(403);
    });
  });

  describe('Edición con bloqueo optimista (V-13, RN-04.11)', () => {
    it('guarda los cambios y registra quién lo modificó', async () => {
      const { admin, cookie } = await creador();
      const creado = await http().post('/api/v1/cursos').set('Cookie', cookie).send(datosCurso()).expect(201);

      const editado = await http()
        .patch(`/api/v1/cursos/${creado.body.id}`)
        .set('Cookie', cookie)
        .send({ titulo: 'Atención al cliente', esObligatorio: false, fechaLimite: null, actualizadoEn: creado.body.actualizadoEn })
        .expect(200);
      expect(editado.body).toMatchObject({
        titulo: 'Atención al cliente',
        esObligatorio: false,
        fechaLimite: null,
        calificacionMinima: 80,
        actualizadoPor: `${admin.username} Usuario Pruebas`,
      });
      expect(editado.body.actualizadoEn).not.toBe(creado.body.actualizadoEn);
    });

    it('si alguien guardó antes, responde 409 CURSO_MODIFICADO y no sobrescribe nada', async () => {
      const { cookie } = await creador();
      const creado = await http().post('/api/v1/cursos').set('Cookie', cookie).send(datosCurso()).expect(201);
      const leidoEn = creado.body.actualizadoEn;

      await http().patch(`/api/v1/cursos/${creado.body.id}`).set('Cookie', superCookie).send({ titulo: 'Primero', actualizadoEn: leidoEn }).expect(200);
      const segundo = await http()
        .patch(`/api/v1/cursos/${creado.body.id}`)
        .set('Cookie', cookie)
        .send({ titulo: 'Segundo', actualizadoEn: leidoEn })
        .expect(409);
      expect(segundo.body.code).toBe('CURSO_MODIFICADO');

      const actual = await http().get(`/api/v1/cursos/${creado.body.id}`).set('Cookie', cookie).expect(200);
      expect(actual.body.titulo).toBe('Primero');
    });

    it('exige el actualizadoEn que se leyó', async () => {
      const { cookie } = await creador();
      const creado = await http().post('/api/v1/cursos').set('Cookie', cookie).send(datosCurso()).expect(201);
      await http().patch(`/api/v1/cursos/${creado.body.id}`).set('Cookie', cookie).send({ titulo: 'Sin fecha' }).expect(400);
    });
  });

  describe('Portada (RF-04.2, RF-04.6)', () => {
    it('la reduce a 1280 px en WebP; la ve su creador y no otro administrador', async () => {
      const { cookie, sucursalA } = await creador();
      const creado = await http().post('/api/v1/cursos').set('Cookie', cookie).send(datosCurso()).expect(201);

      const conPortada = await http()
        .put(`/api/v1/cursos/${creado.body.id}/portada`)
        .set('Cookie', cookie)
        .attach('portada', await imagen(2400, 1600), 'portada.jpg')
        .expect(200);
      const portadaUrl: string = conPortada.body.portadaUrl;
      expect(portadaUrl).toMatch(/^\/api\/v1\/archivos\/[0-9a-f-]{36}\/contenido$/);

      const descarga = await http().get(portadaUrl).set('Cookie', cookie).buffer(true).expect(200);
      expect(descarga.headers['content-type']).toBe('image/webp');
      expect(await sharp(descarga.body as Buffer).metadata()).toMatchObject({ width: 1280, height: 853 });

      const otro = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.CURSOS_GESTIONAR], sucursalIds: [sucursalA.id] });
      const cookieOtro = await iniciarSesion(e2e.app, otro.username);
      await http().get(portadaUrl).set('Cookie', cookieOtro).expect(404);
      await http().get(portadaUrl).set('Cookie', superCookie).expect(200);
    });

    it('al cambiarla borra la anterior; al quitarla queda sin portada', async () => {
      const { cookie } = await creador();
      const creado = await http().post('/api/v1/cursos').set('Cookie', cookie).send(datosCurso()).expect(201);
      const ruta = `/api/v1/cursos/${creado.body.id}/portada`;

      const primera = await http().put(ruta).set('Cookie', cookie).attach('portada', await imagen(800, 450), 'a.jpg').expect(200);
      await http().put(ruta).set('Cookie', cookie).attach('portada', await imagen(800, 450), 'b.jpg').expect(200);
      await http().get(primera.body.portadaUrl).set('Cookie', cookie).expect(404);

      const sinPortada = await http().delete(ruta).set('Cookie', cookie).expect(200);
      expect(sinPortada.body.portadaUrl).toBeNull();
    });

    it('rechaza un archivo que no es imagen', async () => {
      const { cookie } = await creador();
      const creado = await http().post('/api/v1/cursos').set('Cookie', cookie).send(datosCurso()).expect(201);
      const respuesta = await http()
        .put(`/api/v1/cursos/${creado.body.id}/portada`)
        .set('Cookie', cookie)
        .attach('portada', Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n'), 'portada.jpg')
        .expect(422);
      expect(respuesta.body.code).toBe('ARCHIVO_TIPO_NO_PERMITIDO');
    });
  });
});
