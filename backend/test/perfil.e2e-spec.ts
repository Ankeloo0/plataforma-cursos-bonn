import request from 'supertest';
import sharp from 'sharp';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import { crearAdministrador, crearDosSucursales, obtenerSuperusuario } from './e2e/fabricas.js';
import { iniciarSesion } from './e2e/sesion.js';

const imagen = (formato: 'png' | 'jpeg') =>
  sharp({ create: { width: 800, height: 600, channels: 3, background: '#c47844' } })[formato]().toBuffer();

describe('Mi perfil y foto (HU-06)', () => {
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

  it('muestra el perfil del administrador con sus sucursales; sin foto, fotoUrl es null (RF-01.7, RF-01.9)', async () => {
    const { adminA, sucursalA, empresaA, marca } = await crearDosSucursales(e2e.dataSource);
    const cookie = await iniciarSesion(e2e.app, adminA.username);

    const respuesta = await http().get('/api/v1/perfil').set('Cookie', cookie).expect(200);
    expect(respuesta.body).toMatchObject({
      username: adminA.username,
      rol: 'ADMIN',
      sucursales: [
        { id: sucursalA.id, nombre: 'Sucursal A', empresa: { id: empresaA.id }, marca: { id: marca.id, nombre: marca.nombre } },
      ],
      sucursal: null,
      fotoUrl: null,
    });
  });

  // Pendientes hasta I2: el empleado inicia sesion por /auth/login-empleado, que necesita la tabla empleados (D-34)
  it.todo('muestra al empleado su sucursal, su empresa y su marca');
  it.todo('sube la foto del empleado, la reduce a 512 x 512 y la entrega solo a usuarios autorizados (RNF-04)');

  it('la foto de un administrador solo la ven él y el superusuario', async () => {
    const { adminA, sucursalA } = await crearDosSucursales(e2e.dataSource);
    const otroAdmin = await crearAdministrador(e2e.dataSource, { permisos: ['EMPLEADOS_VER'], sucursalIds: [sucursalA.id] });
    const cookieA = await iniciarSesion(e2e.app, adminA.username);
    const subida = await http().put('/api/v1/perfil/foto').set('Cookie', cookieA).attach('foto', await imagen('png'), 'a.png').expect(200);

    const cookieOtro = await iniciarSesion(e2e.app, otroAdmin.username);
    await http().get(subida.body.fotoUrl).set('Cookie', cookieOtro).expect(404);
  });

  it('al cambiar la foto borra la anterior; al quitarla vuelve a las iniciales', async () => {
    const { adminA } = await crearDosSucursales(e2e.dataSource);
    const cookie = await iniciarSesion(e2e.app, adminA.username);

    const primera = await http().put('/api/v1/perfil/foto').set('Cookie', cookie).attach('foto', await imagen('png'), 'a.png').expect(200);
    await http().put('/api/v1/perfil/foto').set('Cookie', cookie).attach('foto', await imagen('jpeg'), 'b.jpg').expect(200);

    await http().get(primera.body.fotoUrl).set('Cookie', cookie).expect(404);
    expect(await e2e.dataSource.query('SELECT id FROM archivos')).toHaveLength(1);

    const sinFoto = await http().delete('/api/v1/perfil/foto').set('Cookie', cookie).expect(200);
    expect(sinFoto.body.fotoUrl).toBeNull();
    expect(await e2e.dataSource.query('SELECT id FROM archivos')).toHaveLength(0);
  });

  it('rechaza archivos que no son JPG, PNG o WebP por su contenido real (RN-01.8)', async () => {
    const { adminA } = await crearDosSucursales(e2e.dataSource);
    const cookie = await iniciarSesion(e2e.app, adminA.username);

    const respuesta = await http()
      .put('/api/v1/perfil/foto')
      .set('Cookie', cookie)
      .attach('foto', Buffer.from('%PDF-1.7 documento'), 'foto.jpg')
      .expect(422);
    expect(respuesta.body.code).toBe('ARCHIVO_TIPO_NO_PERMITIDO');
  });

  it('rechaza fotos de más de 5 MB (RN-01.8)', async () => {
    const { adminA } = await crearDosSucursales(e2e.dataSource);
    const cookie = await iniciarSesion(e2e.app, adminA.username);

    const respuesta = await http()
      .put('/api/v1/perfil/foto')
      .set('Cookie', cookie)
      .attach('foto', Buffer.alloc(5 * 1024 * 1024 + 1), 'enorme.png')
      .expect(413);
    expect(respuesta.body.code).toBe('ARCHIVO_DEMASIADO_GRANDE');
  });

  it('el superusuario carga la foto de un administrador (RF-01.8)', async () => {
    const { adminA } = await crearDosSucursales(e2e.dataSource);
    const superCookie = await iniciarSesion(e2e.app, (await obtenerSuperusuario(e2e.dataSource)).username);

    const respuesta = await http()
      .put(`/api/v1/administradores/${adminA.id}/foto`)
      .set('Cookie', superCookie)
      .attach('foto', await imagen('png'), 'admin.png')
      .expect(200);
    expect(respuesta.body.fotoUrl).not.toBeNull();
  });
});
