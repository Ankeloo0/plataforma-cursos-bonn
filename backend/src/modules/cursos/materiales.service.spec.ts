import type { DataSource } from 'typeorm';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import type { ArchivosService } from '../archivos/archivos.service.js';
import type { CompresionVideoService } from '../archivos/compresion-video.service.js';
import type { MediosService } from '../archivos/medios.service.js';
import type { CursosRepository } from './cursos.repository.js';
import type { MaterialesRepository } from './materiales.repository.js';
import { MaterialesService } from './materiales.service.js';
import type { TemasService } from './temas.service.js';

const admin = { id: 'a1', rol: 'ADMIN', permisos: ['CURSOS_GESTIONAR'] } as unknown as UsuarioSesion;
const tema = { id: 't1', cursoId: 'c1' };

function materialDe(cambios: object = {}) {
  return {
    id: 'm1',
    temaId: 't1',
    titulo: 'Material',
    descripcion: null,
    tipo: 'PDF',
    orden: 1,
    activo: true,
    archivoId: 'viejo',
    archivo: null,
    urlExterna: null,
    duracionSegundos: 0,
    actualizadoEn: new Date(),
    ...cambios,
  };
}

function crear(tipoDelArchivo = 'VIDEO', material = materialDe()) {
  const manager = {};
  const repo = {
    crear: vi.fn().mockResolvedValue({ id: 'm1' }),
    buscarPorId: vi.fn().mockResolvedValue(material),
    listarPorTemas: vi.fn().mockResolvedValue([]),
    actualizarSiNoCambio: vi.fn().mockResolvedValue(true),
    reordenar: vi.fn(),
    eliminar: vi.fn(),
    imagenesDe: vi.fn().mockResolvedValue([]),
    agregarImagenes: vi.fn(),
    quitarImagenes: vi.fn(),
  };
  const temas = { buscarEditable: vi.fn().mockResolvedValue(tema) };
  const cursos = { recalcularDuracion: vi.fn() };
  const archivos = {
    exigirParaMaterial: vi.fn().mockResolvedValue({ archivo: { id: 'nuevo', storageKey: 'materiales/x' }, tipo: tipoDelArchivo }),
    eliminar: vi.fn(),
  };
  const medios = { duracionVideoSegundos: vi.fn().mockResolvedValue(754), textoPdf: vi.fn().mockResolvedValue('texto') };
  const compresion = { encolar: vi.fn() };
  const dataSource = { transaction: vi.fn((trabajo: (m: object) => Promise<unknown>) => trabajo(manager)) };
  const servicio = new MaterialesService(
    repo as unknown as MaterialesRepository,
    temas as unknown as TemasService,
    cursos as unknown as CursosRepository,
    archivos as unknown as ArchivosService,
    medios as unknown as MediosService,
    compresion as unknown as CompresionVideoService,
    dataSource as unknown as DataSource,
  );
  return { servicio, repo, cursos, archivos, medios, compresion, manager };
}

describe('MaterialesService', () => {
  it('un video guarda la duracion que mide ffprobe y recalcula la duracion del curso (D-36)', async () => {
    const { servicio, repo, cursos, manager } = crear('VIDEO');

    await servicio.crear('t1', { tipo: 'VIDEO', titulo: 'Bienvenida', archivoId: 'nuevo' }, admin);

    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ archivoId: 'nuevo', duracionSegundos: 754, textoExtraido: null, urlExterna: null, creadoPor: 'a1' }),
      manager,
    );
    expect(cursos.recalcularDuracion).toHaveBeenCalledWith('c1', 'a1', manager);
  });

  it('un video se manda a comprimir despues de guardar el material (RF-04.6)', async () => {
    const { servicio, repo, compresion } = crear('VIDEO');

    await servicio.crear('t1', { tipo: 'VIDEO', titulo: 'Bienvenida', archivoId: 'nuevo' }, admin);

    expect(compresion.encolar).toHaveBeenCalledWith('nuevo');
    expect(compresion.encolar.mock.invocationCallOrder[0]).toBeGreaterThan(repo.crear.mock.invocationCallOrder[0]);
  });

  it('al reemplazar un video comprime el nuevo; si solo cambia el titulo, no comprime nada', async () => {
    const { servicio, compresion } = crear('VIDEO', materialDe({ tipo: 'VIDEO' }));
    const actualizadoEn = new Date().toISOString();

    await servicio.actualizar('m1', { titulo: 'Otro titulo', actualizadoEn }, admin);
    expect(compresion.encolar).not.toHaveBeenCalled();

    await servicio.actualizar('m1', { archivoId: 'nuevo', actualizadoEn }, admin);
    expect(compresion.encolar).toHaveBeenCalledWith('nuevo');
  });

  it('un PDF guarda su texto para el asistente y no suma duracion (D-33)', async () => {
    const { servicio, repo, medios, compresion } = crear('PDF');

    await servicio.crear('t1', { tipo: 'PDF', titulo: 'Manual', archivoId: 'nuevo' }, admin);

    expect(medios.duracionVideoSegundos).not.toHaveBeenCalled();
    expect(compresion.encolar).not.toHaveBeenCalled();
    expect(repo.crear.mock.calls[0][0]).toMatchObject({ textoExtraido: 'texto', duracionSegundos: 0 });
  });

  it('rechaza un archivo cuyo tipo real no es el del material', async () => {
    const { servicio, repo } = crear('PDF');

    await expect(servicio.crear('t1', { tipo: 'VIDEO', titulo: 'Video', archivoId: 'nuevo' }, admin)).rejects.toMatchObject({
      response: { code: 'ARCHIVO_TIPO_NO_COINCIDE' },
    });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('un enlace no lleva archivo', async () => {
    const { servicio, repo, archivos } = crear();

    await servicio.crear('t1', { tipo: 'ENLACE', titulo: 'Manual', urlExterna: 'https://vw.com.mx' }, admin);

    expect(archivos.exigirParaMaterial).not.toHaveBeenCalled();
    expect(repo.crear.mock.calls[0][0]).toMatchObject({ archivoId: null, urlExterna: 'https://vw.com.mx' });
  });

  it('al reemplazar el archivo borra el anterior despues de guardar', async () => {
    const { servicio, archivos, repo } = crear('PDF');

    await servicio.actualizar('m1', { archivoId: 'nuevo', actualizadoEn: new Date().toISOString() }, admin);

    expect(repo.actualizarSiNoCambio.mock.calls[0][2]).toMatchObject({ archivoId: 'nuevo', textoExtraido: 'texto' });
    expect(archivos.eliminar).toHaveBeenCalledWith('viejo');
  });

  it('si alguien guardo antes no borra el archivo anterior (V-13)', async () => {
    const { servicio, archivos, repo } = crear('PDF');
    repo.actualizarSiNoCambio.mockResolvedValue(false);

    await expect(
      servicio.actualizar('m1', { archivoId: 'nuevo', actualizadoEn: new Date().toISOString() }, admin),
    ).rejects.toMatchObject({ response: { code: 'CURSO_MODIFICADO' } });
    expect(archivos.eliminar).not.toHaveBeenCalled();
  });

  it('no acepta un enlace en un material con archivo', async () => {
    const { servicio } = crear();
    await expect(
      servicio.actualizar('m1', { urlExterna: 'https://vw.com.mx', actualizadoEn: new Date().toISOString() }, admin),
    ).rejects.toMatchObject({ response: { code: 'MATERIAL_FUENTE_INVALIDA' } });
  });

  it('un articulo guarda su HTML limpio y suma 1 minuto por cada 240 palabras (D-37)', async () => {
    const { servicio, repo, archivos, cursos, manager } = crear();
    const texto = Array.from({ length: 300 }, () => 'palabra').join(' ');

    await servicio.crear('t1', { tipo: 'ARTICULO', titulo: 'Recepcion', contenido: `<p>${texto}</p><script>alert(1)</script>` }, admin);

    expect(archivos.exigirParaMaterial).not.toHaveBeenCalled();
    expect(repo.crear.mock.calls[0][0]).toMatchObject({
      contenido: `<p>${texto}</p>`,
      duracionSegundos: 120,
      archivoId: null,
      urlExterna: null,
      textoExtraido: null,
    });
    expect(cursos.recalcularDuracion).toHaveBeenCalledWith('c1', 'a1', manager);
  });

  it('rechaza un articulo que se queda sin texto al limpiarlo', async () => {
    const { servicio, repo } = crear();

    await expect(
      servicio.crear('t1', { tipo: 'ARTICULO', titulo: 'Vacio', contenido: '<p> </p><script>alert(1)</script>' }, admin),
    ).rejects.toMatchObject({ response: { code: 'ARTICULO_VACIO' } });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('al editar un articulo recalcula su duracion con el texto nuevo', async () => {
    const { servicio, repo, cursos } = crear('PDF', materialDe({ tipo: 'ARTICULO', archivoId: null, contenido: '<p>Antes</p>' }));

    await servicio.actualizar('m1', { contenido: '<p>Texto nuevo</p>', actualizadoEn: new Date().toISOString() }, admin);

    expect(repo.actualizarSiNoCambio.mock.calls[0][2]).toMatchObject({ contenido: '<p>Texto nuevo</p>', duracionSegundos: 60 });
    expect(cursos.recalcularDuracion).toHaveBeenCalled();
  });

  describe('imágenes de una página (D-39)', () => {
    const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const img = (n: number) => `<img src="/api/v1/archivos/${id(n)}/contenido" alt="Foto ${n}">`;
    const actualizadoEn = new Date().toISOString();
    const pagina = () => materialDe({ tipo: 'ARTICULO', archivoId: null, contenido: `<p>Antes</p>${img(1)}${img(2)}` });

    it('al crear valida cada imagen y la liga a la página; las imágenes no suman tiempo', async () => {
      const { servicio, repo, archivos, manager } = crear('IMAGEN');

      await servicio.crear('t1', { tipo: 'ARTICULO', titulo: 'Motor', contenido: `${img(1)}${img(1)}${img(2)}` }, admin);

      expect(archivos.exigirParaMaterial.mock.calls.map((c) => c[0])).toEqual([id(1), id(2)]);
      expect(repo.crear.mock.calls[0][0]).toMatchObject({ duracionSegundos: 0 });
      expect(repo.agregarImagenes).toHaveBeenCalledWith('m1', [id(1), id(2)], 'a1', manager);
    });

    it('solo acepta imágenes como imágenes de la página', async () => {
      const { servicio, repo } = crear('PDF');

      await expect(
        servicio.crear('t1', { tipo: 'ARTICULO', titulo: 'Motor', contenido: `<p>Hola</p>${img(1)}` }, admin),
      ).rejects.toMatchObject({ response: { code: 'ARCHIVO_TIPO_NO_COINCIDE' } });
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('acepta hasta 30 imágenes', async () => {
      const { servicio } = crear('IMAGEN');
      const muchas = Array.from({ length: 31 }, (_, i) => img(i + 1)).join('');

      await expect(servicio.crear('t1', { tipo: 'ARTICULO', titulo: 'Motor', contenido: muchas }, admin)).rejects.toMatchObject({
        response: { code: 'PAGINA_DEMASIADAS_IMAGENES' },
      });
    });

    it('al editar solo valida las nuevas, liga las nuevas, quita las que ya no están y borra su archivo', async () => {
      const { servicio, repo, archivos, manager } = crear('IMAGEN', pagina());
      repo.imagenesDe.mockResolvedValue([id(1), id(2)]);

      await servicio.actualizar('m1', { contenido: `<p>Después</p>${img(2)}${img(3)}`, actualizadoEn }, admin);

      expect(archivos.exigirParaMaterial.mock.calls.map((c) => c[0])).toEqual([id(3)]);
      expect(repo.quitarImagenes).toHaveBeenCalledWith('m1', [id(1)], manager);
      expect(repo.agregarImagenes).toHaveBeenCalledWith('m1', [id(3)], 'a1', manager);
      expect(archivos.eliminar).toHaveBeenCalledWith(id(1));
    });

    it('si alguien guardó antes no quita ni borra imágenes (V-13)', async () => {
      const { servicio, repo, archivos } = crear('IMAGEN', pagina());
      repo.imagenesDe.mockResolvedValue([id(1), id(2)]);
      repo.actualizarSiNoCambio.mockResolvedValue(false);

      await expect(servicio.actualizar('m1', { contenido: '<p>Solo texto</p>', actualizadoEn }, admin)).rejects.toMatchObject({
        response: { code: 'CURSO_MODIFICADO' },
      });
      expect(repo.quitarImagenes).not.toHaveBeenCalled();
      expect(archivos.eliminar).not.toHaveBeenCalled();
    });

    it('al borrar la página borra también el archivo de cada imagen', async () => {
      const { servicio, repo, archivos } = crear('IMAGEN', pagina());
      repo.imagenesDe.mockResolvedValue([id(1), id(2)]);

      await servicio.eliminar('m1', admin);

      expect(archivos.eliminar.mock.calls.map((c) => c[0])).toEqual([id(1), id(2)]);
    });
  });

  it('cada tipo solo acepta su fuente al editar', async () => {
    const articulo = crear('PDF', materialDe({ tipo: 'ARTICULO', archivoId: null }));
    const conArchivo = crear('PDF');
    const actualizadoEn = new Date().toISOString();

    await expect(articulo.servicio.actualizar('m1', { archivoId: 'nuevo', actualizadoEn }, admin)).rejects.toMatchObject({
      response: { code: 'MATERIAL_FUENTE_INVALIDA' },
    });
    await expect(conArchivo.servicio.actualizar('m1', { contenido: '<p>Hola</p>', actualizadoEn }, admin)).rejects.toMatchObject({
      response: { code: 'MATERIAL_FUENTE_INVALIDA' },
    });
  });

  it('el orden debe traer exactamente los materiales del tema', async () => {
    const { servicio, repo } = crear();
    repo.listarPorTemas.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);

    await expect(servicio.reordenar('t1', ['m1'], admin)).rejects.toMatchObject({ response: { code: 'CURSO_MODIFICADO' } });
    await servicio.reordenar('t1', ['m2', 'm1'], admin);
    expect(repo.reordenar).toHaveBeenCalledWith('t1', ['m2', 'm1'], expect.anything());
  });
});
