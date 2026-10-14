import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { PERMISOS, type Permiso } from '../src/common/constants/permisos.js';
import { ArchivosService } from '../src/modules/archivos/archivos.service.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import { crearAdministrador, crearDosSucursales, obtenerSuperusuario } from './e2e/fabricas.js';
import { iniciarSesion } from './e2e/sesion.js';
import { documentoDePrueba, pdfConTexto, videoDePrueba } from './fixtures/archivos.js';

const imagen = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#287c42' } }).png().toBuffer();

describe('Temas y materiales (HU-15, I3.2)', () => {
  let e2e: AppE2e;
  let superCookie: string;
  const http = () => request(e2e.app.getHttpServer());
  const storage = () => process.env.STORAGE_LOCAL_PATH!;

  beforeAll(async () => {
    e2e = await crearAppE2e();
  });

  beforeEach(async () => {
    await limpiarBase(e2e.dataSource);
    superCookie = await iniciarSesion(e2e.app, (await obtenerSuperusuario(e2e.dataSource)));
  });

  afterAll(async () => {
    await limpiarBase(e2e.dataSource);
    await e2e.app.close();
  });

  // Administrador con "Gestionar cursos" en la sucursal A, con un curso suyo
  async function creadorConCurso(permisos: Permiso[] = [PERMISOS.CURSOS_GESTIONAR]) {
    const { sucursalA } = await crearDosSucursales(e2e.dataSource);
    const admin = await crearAdministrador(e2e.dataSource, { permisos, sucursalIds: [sucursalA.id] });
    const cookie = await iniciarSesion(e2e.app, admin);
    const curso = await http()
      .post('/api/v1/cursos')
      .set('Cookie', superCookie)
      .send({ titulo: 'Seguridad en el taller', esObligatorio: true, calificacionMinima: 80 })
      .expect(201);
    // El curso es del administrador: mientras no hay destinos (I4), solo su creador lo edita
    await e2e.dataSource.query(`UPDATE cursos SET creado_por = $1 WHERE id = $2`, [admin.id, curso.body.id]);
    return { admin, cookie, sucursalA, cursoId: curso.body.id as string };
  }

  const subir = (cookie: string, contenido: Buffer, nombre: string) =>
    http().post('/api/v1/archivos').set('Cookie', cookie).attach('archivo', contenido, nombre);

  const crearTema = async (cookie: string, cursoId: string, titulo = 'Introducción') =>
    (await http().post(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookie).send({ titulo }).expect(201)).body;

  async function crearMaterialPdf(cookie: string, temaId: string, titulo = 'Reglamento') {
    const archivo = await subir(cookie, pdfConTexto('Reglamento del taller'), 'reglamento.pdf').expect(201);
    return (
      await http()
        .post(`/api/v1/temas/${temaId}/materiales`)
        .set('Cookie', cookie)
        .send({ tipo: 'PDF', titulo, archivoId: archivo.body.id })
        .expect(201)
    ).body;
  }

  const temporales = async () => readdir(path.join(storage(), 'tmp')).catch(() => []);

  describe('Subida en dos pasos (RF-04.5, technical-spec 4.8)', () => {
    it('sube un video, mide su duración con ffprobe y lo entrega por rangos para adelantarlo', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);

      const subido = await subir(cookie, await videoDePrueba(), 'bienvenida.mp4').expect(201);
      expect(subido.body).toMatchObject({ nombreOriginal: 'bienvenida.mp4', mimeType: 'video/mp4', tipoMaterial: 'VIDEO' });
      expect(await temporales()).toHaveLength(0);

      const material = await http()
        .post(`/api/v1/temas/${tema.id}/materiales`)
        .set('Cookie', cookie)
        .send({ tipo: 'VIDEO', titulo: 'Bienvenida', archivoId: subido.body.id })
        .expect(201);
      expect(material.body).toMatchObject({
        tipo: 'VIDEO',
        orden: 1,
        activo: true,
        duracionSegundos: 3,
        urlExterna: null,
        archivo: { id: subido.body.id, mimeType: 'video/mp4', estado: 'PROCESANDO' },
      });

      // FFmpeg lo comprime en segundo plano (RF-04.6); mientras tanto el original se puede ver
      await vi.waitFor(
        async () => {
          const temas = await http().get(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookie).expect(200);
          expect(temas.body[0].materiales[0].archivo.estado).toBe('LISTO');
        },
        { timeout: 20_000, interval: 250 },
      );

      const parcial = await http().get(material.body.archivo.url).set('Cookie', cookie).set('Range', 'bytes=0-99').expect(206);
      expect(parcial.headers['content-range']).toMatch(/^bytes 0-99\/\d+$/);
      expect(parcial.headers['content-disposition']).toBe("inline; filename*=UTF-8''bienvenida.mp4");
    });

    it('comprime una imagen a 1280 px en WebP, extrae el texto de un PDF y acepta un documento de Word', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);

      const foto = await subir(cookie, await imagen(2600, 1300), 'motor.png').expect(201);
      expect(foto.body).toMatchObject({ mimeType: 'image/webp', tipoMaterial: 'IMAGEN' });
      const materialFoto = await http()
        .post(`/api/v1/temas/${tema.id}/materiales`)
        .set('Cookie', cookie)
        .send({ tipo: 'IMAGEN', titulo: 'Motor', archivoId: foto.body.id })
        .expect(201);
      const descarga = await http().get(materialFoto.body.archivo.url).set('Cookie', cookie).buffer(true).expect(200);
      expect(await sharp(descarga.body as Buffer).metadata()).toMatchObject({ width: 1280, height: 640, format: 'webp' });

      const pdf = await crearMaterialPdf(cookie, tema.id);
      const [fila] = await e2e.dataSource.query(`SELECT texto_extraido FROM materiales WHERE id = $1`, [pdf.id]);
      expect(fila.texto_extraido).toContain('Reglamento del taller');
      expect(pdf).not.toHaveProperty('textoExtraido');

      const docx = await subir(cookie, await documentoDePrueba(), 'politicas.docx').expect(201);
      expect(docx.body.tipoMaterial).toBe('DOCUMENTO');
    });

    it('rechaza un tipo no permitido por su contenido real y borra el temporal', async () => {
      const { cookie } = await creadorConCurso();
      const respuesta = await subir(cookie, Buffer.from('solo texto, aunque diga .mp4'), 'video.mp4').expect(422);
      expect(respuesta.body.code).toBe('ARCHIVO_TIPO_NO_PERMITIDO');
      await subir(cookie, Buffer.alloc(0), 'vacio.pdf').expect(422);
      expect(await temporales()).toHaveLength(0);
    });

    it('el material solo acepta un archivo de su tipo, subido por quien guarda y sin usar', async () => {
      const { cookie, cursoId, sucursalA } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const pdf = await subir(cookie, pdfConTexto('Hola'), 'a.pdf').expect(201);
      const crear = (datos: object, c = cookie) => http().post(`/api/v1/temas/${tema.id}/materiales`).set('Cookie', c).send(datos);

      expect((await crear({ tipo: 'VIDEO', titulo: 'Video', archivoId: pdf.body.id }).expect(422)).body.code).toBe('ARCHIVO_TIPO_NO_COINCIDE');

      const otro = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.CURSOS_GESTIONAR], sucursalIds: [sucursalA.id] });
      const ajeno = await subir(await iniciarSesion(e2e.app, otro), pdfConTexto('Ajeno'), 'b.pdf').expect(201);
      expect((await crear({ tipo: 'PDF', titulo: 'Ajeno', archivoId: ajeno.body.id }).expect(422)).body.code).toBe('ARCHIVO_NO_DISPONIBLE');

      await crear({ tipo: 'PDF', titulo: 'Primero', archivoId: pdf.body.id }).expect(201);
      expect((await crear({ tipo: 'PDF', titulo: 'Repetido', archivoId: pdf.body.id }).expect(422)).body.code).toBe('ARCHIVO_NO_DISPONIBLE');

      await crear({ tipo: 'PDF', titulo: 'Sin archivo' }).expect(400);
    });

    it('cancelar una subida borra el archivo; no se cancela uno ajeno ni uno en uso', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const subido = await subir(cookie, pdfConTexto('Cancelar'), 'c.pdf').expect(201);

      await http().delete(`/api/v1/archivos/${subido.body.id}`).set('Cookie', superCookie).expect(404);
      await http().delete(`/api/v1/archivos/${subido.body.id}`).set('Cookie', cookie).expect(204);
      const [{ count }] = await e2e.dataSource.query(`SELECT count(*)::int AS count FROM archivos`);
      expect(count).toBe(0);

      const tema = await crearTema(cookie, cursoId);
      const material = await crearMaterialPdf(cookie, tema.id);
      const enUso = await http().delete(`/api/v1/archivos/${material.archivo.id}`).set('Cookie', cookie).expect(409);
      expect(enUso.body.code).toBe('ARCHIVO_EN_USO');
    });

    it('la limpieza diaria borra solo los archivos de materiales sin usar de más de 24 horas', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const usado = await crearMaterialPdf(cookie, tema.id);
      const viejo = await subir(cookie, pdfConTexto('Viejo'), 'viejo.pdf').expect(201);
      const reciente = await subir(cookie, pdfConTexto('Reciente'), 'reciente.pdf').expect(201);
      await e2e.dataSource.query(`UPDATE archivos SET creado_en = now() - interval '2 days' WHERE id IN ($1, $2)`, [
        viejo.body.id,
        usado.archivo.id,
      ]);

      await e2e.app.get(ArchivosService).limpiarSinUsar();

      const ids: { id: string }[] = await e2e.dataSource.query(`SELECT id FROM archivos`);
      expect(ids.map((a) => a.id)).toHaveLength(2);
      expect(ids.map((a) => a.id)).toEqual(expect.arrayContaining([usado.archivo.id, reciente.body.id]));
    });

    it('sin "Gestionar cursos" no se sube nada', async () => {
      const { cookie } = await creadorConCurso([PERMISOS.CURSOS_ASIGNAR]);
      await subir(cookie, pdfConTexto('No'), 'no.pdf').expect(403);
    });
  });

  describe('Temas (RF-04.3)', () => {
    it('agrega temas al final, los reordena y los devuelve en orden con sus materiales', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const uno = await crearTema(cookie, cursoId, 'Uno');
      const dos = await crearTema(cookie, cursoId, 'Dos');
      const tres = await crearTema(cookie, cursoId, 'Tres');
      expect([uno.orden, dos.orden, tres.orden]).toEqual([1, 2, 3]);
      await crearMaterialPdf(cookie, dos.id);

      await http().put(`/api/v1/cursos/${cursoId}/temas/orden`).set('Cookie', cookie).send({ ids: [tres.id, uno.id, dos.id] }).expect(204);

      const contenido = await http().get(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookie).expect(200);
      expect(contenido.body.map((t: { titulo: string; orden: number }) => [t.titulo, t.orden])).toEqual([
        ['Tres', 1],
        ['Uno', 2],
        ['Dos', 3],
      ]);
      expect(contenido.body[2].materiales).toHaveLength(1);
    });

    it('un orden que no trae exactamente los temas del curso responde 409', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const uno = await crearTema(cookie, cursoId, 'Uno');
      await crearTema(cookie, cursoId, 'Dos');
      const respuesta = await http().put(`/api/v1/cursos/${cursoId}/temas/orden`).set('Cookie', cookie).send({ ids: [uno.id] }).expect(409);
      expect(respuesta.body.code).toBe('CURSO_MODIFICADO');
    });

    it('editar un tema exige el actualizadoEn que se leyó (V-13) y marca el curso como modificado', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);

      const editado = await http()
        .patch(`/api/v1/temas/${tema.id}`)
        .set('Cookie', cookie)
        .send({ titulo: 'Bienvenida', actualizadoEn: tema.actualizadoEn })
        .expect(200);
      expect(editado.body.titulo).toBe('Bienvenida');

      const tarde = await http()
        .patch(`/api/v1/temas/${tema.id}`)
        .set('Cookie', cookie)
        .send({ titulo: 'Tarde', actualizadoEn: tema.actualizadoEn })
        .expect(409);
      expect(tarde.body.code).toBe('CURSO_MODIFICADO');

      const curso = await http().get(`/api/v1/cursos/${cursoId}`).set('Cookie', cookie).expect(200);
      expect(curso.body.actualizadoPor).toBe('Usuario Pruebas');
    });

    it('eliminar un tema borra sus materiales y sus archivos del disco', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const material = await crearMaterialPdf(cookie, tema.id);
      const [{ storage_key: storageKey }] = await e2e.dataSource.query(`SELECT storage_key FROM archivos WHERE id = $1`, [material.archivo.id]);

      await http().delete(`/api/v1/temas/${tema.id}`).set('Cookie', cookie).expect(204);

      await http().get(material.archivo.url).set('Cookie', cookie).expect(404);
      await expect(access(path.join(storage(), storageKey))).rejects.toThrow();
      expect((await http().get(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookie).expect(200)).body).toEqual([]);
    });
  });

  describe('Materiales (RF-04.4)', () => {
    it('ocultar un video lo quita de la duración del curso; mostrarlo lo vuelve a sumar (D-36)', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const subido = await subir(cookie, await videoDePrueba(), 'video.mp4').expect(201);
      const video = await http()
        .post(`/api/v1/temas/${tema.id}/materiales`)
        .set('Cookie', cookie)
        .send({ tipo: 'VIDEO', titulo: 'Video', archivoId: subido.body.id })
        .expect(201);
      // 1.5 horas, para que se note en numeric(6,2)
      await e2e.dataSource.query(`UPDATE materiales SET duracion_segundos = 5400 WHERE id = $1`, [video.body.id]);
      const duracion = async () => (await http().get(`/api/v1/cursos/${cursoId}`).set('Cookie', cookie).expect(200)).body.duracionHoras;

      await http().post(`/api/v1/materiales/${video.body.id}/ocultar`).set('Cookie', cookie).expect(200);
      expect(await duracion()).toBe(0);
      const visible = await http().post(`/api/v1/materiales/${video.body.id}/mostrar`).set('Cookie', cookie).expect(200);
      expect(visible.body.activo).toBe(true);
      expect(await duracion()).toBe(1.5);

      await http().post(`/api/v1/temas/${tema.id}/ocultar`).set('Cookie', cookie).expect(200);
      expect(await duracion()).toBe(0);
    });

    it('un enlace solo acepta http o https', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const crear = (urlExterna: string) =>
        http().post(`/api/v1/temas/${tema.id}/materiales`).set('Cookie', cookie).send({ tipo: 'ENLACE', titulo: 'Manual', urlExterna });

      await crear('javascript:alert(1)').expect(400);
      await crear('ftp://servidor/manual.pdf').expect(400);
      const enlace = await crear('https://www.vw.com.mx/manual').expect(201);
      expect(enlace.body).toMatchObject({ tipo: 'ENLACE', urlExterna: 'https://www.vw.com.mx/manual', archivo: null });
    });

    it('un artículo se guarda limpio, suma su tiempo de lectura al curso y se puede editar (D-37)', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const crear = (contenido: unknown) =>
        http().post(`/api/v1/temas/${tema.id}/materiales`).set('Cookie', cookie).send({ tipo: 'ARTICULO', titulo: 'Recepción', contenido });
      const duracion = async () => (await http().get(`/api/v1/cursos/${cursoId}`).set('Cookie', cookie).expect(200)).body.duracionHoras;
      // 21 600 palabras con el subtitulo = 90 minutos (1 minuto por cada 240)
      const largo = Array.from({ length: 21_599 }, () => 'vw').join(' ');

      const articulo = await crear(`<h2>Pasos</h2><p onclick="robar()">${largo}</p><script>alert(1)</script>`).expect(201);
      expect(articulo.body).toMatchObject({ tipo: 'ARTICULO', archivo: null, urlExterna: null, duracionSegundos: 5400 });
      expect(articulo.body.contenido).toBe(`<h2>Pasos</h2><p>${largo}</p>`);
      const [fila] = await e2e.dataSource.query(`SELECT contenido FROM materiales WHERE id = $1`, [articulo.body.id]);
      expect(fila.contenido).not.toContain('script');
      expect(await duracion()).toBe(1.5);

      const editado = await http()
        .patch(`/api/v1/materiales/${articulo.body.id}`)
        .set('Cookie', cookie)
        .send({ contenido: '<p>Ahora es corto.</p>', actualizadoEn: articulo.body.actualizadoEn })
        .expect(200);
      expect(editado.body).toMatchObject({ contenido: '<p>Ahora es corto.</p>', duracionSegundos: 60 });

      expect((await crear('<p> </p><script>alert(1)</script>').expect(422)).body.code).toBe('ARTICULO_VACIO');
      await crear(`<p>${'a'.repeat(100_001)}</p>`).expect(400);
      await crear(undefined).expect(400);
    });

    it('una página guarda sus imágenes, las entrega a quien ve el curso y borra las que se quitan (D-39)', async () => {
      const { cookie, cursoId, sucursalA } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const primera = (await subir(cookie, await imagen(2000, 1000), 'motor.png').expect(201)).body;
      const segunda = (await subir(cookie, await imagen(400, 300), 'frenos.png').expect(201)).body;
      const img = (archivo: { id: string }, alt: string) => `<img src="/api/v1/archivos/${archivo.id}/contenido" alt="${alt}">`;

      const pagina = await http()
        .post(`/api/v1/temas/${tema.id}/materiales`)
        .set('Cookie', cookie)
        .send({ tipo: 'ARTICULO', titulo: 'Motor', contenido: `<p>Revisa el motor.</p>${img(primera, 'Motor')}${img(segunda, 'Frenos')}` })
        .expect(201);
      expect(pagina.body.contenido).toContain(`src="/api/v1/archivos/${primera.id}/contenido" alt="Motor"`);
      const ligadas = await e2e.dataSource.query(`SELECT archivo_id FROM materiales_imagenes WHERE material_id = $1`, [pagina.body.id]);
      expect(ligadas.map((f: { archivo_id: string }) => f.archivo_id)).toEqual(expect.arrayContaining([primera.id, segunda.id]));
      expect(ligadas).toHaveLength(2);

      //la ve quien ve el curso, y nadie mas
      const vista = await http().get(`/api/v1/archivos/${primera.id}/contenido`).set('Cookie', cookie).buffer(true).expect(200);
      expect(await sharp(vista.body as Buffer).metadata()).toMatchObject({ width: 1280, format: 'webp' });
      const otro = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.CURSOS_GESTIONAR], sucursalIds: [sucursalA.id] });
      const cookieOtro = await iniciarSesion(e2e.app, otro);
      await http().get(`/api/v1/archivos/${primera.id}/contenido`).set('Cookie', cookieOtro).expect(404);

      //ya en uso: no se cancela, no sirve para otro material y la limpieza diaria no la toca
      await http().delete(`/api/v1/archivos/${primera.id}`).set('Cookie', cookie).expect(409);
      const robada = await http()
        .post(`/api/v1/temas/${tema.id}/materiales`)
        .set('Cookie', cookie)
        .send({ tipo: 'ARTICULO', titulo: 'Copia', contenido: img(primera, 'Motor') })
        .expect(422);
      expect(robada.body.code).toBe('ARCHIVO_NO_DISPONIBLE');
      await e2e.dataSource.query(`UPDATE archivos SET creado_en = now() - interval '2 days'`);
      await e2e.app.get(ArchivosService).limpiarSinUsar();
      await http().get(`/api/v1/archivos/${primera.id}/contenido`).set('Cookie', cookie).expect(200);

      //al quitar una imagen se borra su archivo
      const editada = await http()
        .patch(`/api/v1/materiales/${pagina.body.id}`)
        .set('Cookie', cookie)
        .send({ contenido: `<p>Revisa el motor.</p>${img(segunda, 'Frenos')}`, actualizadoEn: pagina.body.actualizadoEn })
        .expect(200);
      expect(editada.body.contenido).not.toContain(primera.id);
      await http().get(`/api/v1/archivos/${primera.id}/contenido`).set('Cookie', cookie).expect(404);
      await http().get(`/api/v1/archivos/${segunda.id}/contenido`).set('Cookie', cookie).expect(200);

      //al borrar la pagina se borran las que quedaban
      await http().delete(`/api/v1/materiales/${pagina.body.id}`).set('Cookie', cookie).expect(204);
      expect(await e2e.dataSource.query(`SELECT id FROM archivos WHERE id = $1`, [segunda.id])).toEqual([]);
    });

    it('una página solo con imágenes es válida y no suma tiempo; con una imagen externa o un PDF, no', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const crear = (contenido: string) =>
        http().post(`/api/v1/temas/${tema.id}/materiales`).set('Cookie', cookie).send({ tipo: 'ARTICULO', titulo: 'Fotos', contenido });
      const foto = (await subir(cookie, await imagen(300, 200), 'a.png').expect(201)).body;
      const pdf = (await subir(cookie, pdfConTexto('Hola'), 'a.pdf').expect(201)).body;

      const soloImagen = await crear(`<img src="/api/v1/archivos/${foto.id}/contenido" alt="Taller">`).expect(201);
      expect(soloImagen.body.duracionSegundos).toBe(0);
      expect((await crear('<img src="https://otro.com/a.png" alt="x">').expect(422)).body.code).toBe('ARTICULO_VACIO');
      const conPdf = await crear(`<p>Hola</p><img src="/api/v1/archivos/${pdf.id}/contenido" alt="x">`).expect(422);
      expect(conPdf.body.code).toBe('ARCHIVO_TIPO_NO_COINCIDE');
    });

    it('eliminar un tema o un curso en borrador borra también las imágenes de sus páginas', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const otroTema = await crearTema(cookie, cursoId, 'Cierre');
      const conImagen = async (temaId: string) => {
        const foto = (await subir(cookie, await imagen(300, 200), 'a.png').expect(201)).body;
        await http()
          .post(`/api/v1/temas/${temaId}/materiales`)
          .set('Cookie', cookie)
          .send({ tipo: 'ARTICULO', titulo: 'Fotos', contenido: `<img src="/api/v1/archivos/${foto.id}/contenido" alt="a">` })
          .expect(201);
        return foto.id as string;
      };
      const delTema = await conImagen(tema.id);
      const delCurso = await conImagen(otroTema.id);

      await http().delete(`/api/v1/temas/${tema.id}`).set('Cookie', cookie).expect(204);
      expect(await e2e.dataSource.query(`SELECT id FROM archivos WHERE id = $1`, [delTema])).toEqual([]);

      await http().delete(`/api/v1/cursos/${cursoId}`).set('Cookie', superCookie).expect(204);
      expect(await e2e.dataSource.query(`SELECT id FROM archivos WHERE id = $1`, [delCurso])).toEqual([]);
    });

    it('reemplazar el archivo borra el anterior; reordena dentro del tema', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const primero = await crearMaterialPdf(cookie, tema.id, 'Primero');
      const segundo = await crearMaterialPdf(cookie, tema.id, 'Segundo');

      const nuevo = await subir(cookie, pdfConTexto('Version nueva'), 'nuevo.pdf').expect(201);
      const reemplazado = await http()
        .patch(`/api/v1/materiales/${primero.id}`)
        .set('Cookie', cookie)
        .send({ archivoId: nuevo.body.id, actualizadoEn: primero.actualizadoEn })
        .expect(200);
      expect(reemplazado.body.archivo.id).toBe(nuevo.body.id);
      await http().get(primero.archivo.url).set('Cookie', cookie).expect(404);
      const [fila] = await e2e.dataSource.query(`SELECT texto_extraido FROM materiales WHERE id = $1`, [primero.id]);
      expect(fila.texto_extraido).toContain('Version nueva');

      await http().put(`/api/v1/temas/${tema.id}/materiales/orden`).set('Cookie', cookie).send({ ids: [segundo.id, primero.id] }).expect(204);
      const [contenido] = (await http().get(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookie).expect(200)).body;
      expect(contenido.materiales.map((m: { titulo: string }) => m.titulo)).toEqual(['Segundo', 'Primero']);
    });

    it('eliminar un material borra su archivo', async () => {
      const { cookie, cursoId } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const material = await crearMaterialPdf(cookie, tema.id);
      await http().delete(`/api/v1/materiales/${material.id}`).set('Cookie', cookie).expect(204);
      await http().get(material.archivo.url).set('Cookie', cookie).expect(404);
    });
  });

  describe('Acceso (V-10, V-12)', () => {
    it('otro administrador no ve el contenido ni los archivos; con solo "Asignar cursos" se consulta pero no se edita', async () => {
      const { cookie, cursoId, sucursalA } = await creadorConCurso();
      const tema = await crearTema(cookie, cursoId);
      const material = await crearMaterialPdf(cookie, tema.id);

      const otro = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.CURSOS_GESTIONAR], sucursalIds: [sucursalA.id] });
      const cookieOtro = await iniciarSesion(e2e.app, otro);
      await http().get(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookieOtro).expect(404);
      await http().post(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookieOtro).send({ titulo: 'Intruso' }).expect(404);
      await http().delete(`/api/v1/materiales/${material.id}`).set('Cookie', cookieOtro).expect(404);
      await http().get(material.archivo.url).set('Cookie', cookieOtro).expect(404);
      await http().get(material.archivo.url).set('Cookie', superCookie).expect(200);

      // Quien lo creo pierde "Gestionar cursos" y conserva "Asignar cursos"
      await e2e.dataSource.query(`UPDATE usuarios_permisos SET permiso = $1 WHERE permiso = $2 AND usuario_id = (SELECT creado_por FROM cursos WHERE id = $3)`, [
        PERMISOS.CURSOS_ASIGNAR,
        PERMISOS.CURSOS_GESTIONAR,
        cursoId,
      ]);
      await http().get(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookie).expect(200);
      await http().post(`/api/v1/cursos/${cursoId}/temas`).set('Cookie', cookie).send({ titulo: 'No' }).expect(403);
    });
  });
});
