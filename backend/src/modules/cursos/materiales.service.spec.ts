import type { DataSource } from 'typeorm';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import type { ArchivosService } from '../archivos/archivos.service.js';
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
  };
  const temas = { buscarEditable: vi.fn().mockResolvedValue(tema) };
  const cursos = { recalcularDuracion: vi.fn() };
  const archivos = {
    exigirParaMaterial: vi.fn().mockResolvedValue({ archivo: { id: 'nuevo', storageKey: 'materiales/x' }, tipo: tipoDelArchivo }),
    eliminar: vi.fn(),
  };
  const medios = { duracionVideoSegundos: vi.fn().mockResolvedValue(754), textoPdf: vi.fn().mockResolvedValue('texto') };
  const dataSource = { transaction: vi.fn((trabajo: (m: object) => Promise<unknown>) => trabajo(manager)) };
  const servicio = new MaterialesService(
    repo as unknown as MaterialesRepository,
    temas as unknown as TemasService,
    cursos as unknown as CursosRepository,
    archivos as unknown as ArchivosService,
    medios as unknown as MediosService,
    dataSource as unknown as DataSource,
  );
  return { servicio, repo, cursos, archivos, medios, manager };
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

  it('un PDF guarda su texto para el asistente y no suma duracion (D-33)', async () => {
    const { servicio, repo, medios } = crear('PDF');

    await servicio.crear('t1', { tipo: 'PDF', titulo: 'Manual', archivoId: 'nuevo' }, admin);

    expect(medios.duracionVideoSegundos).not.toHaveBeenCalled();
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

  it('el orden debe traer exactamente los materiales del tema', async () => {
    const { servicio, repo } = crear();
    repo.listarPorTemas.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);

    await expect(servicio.reordenar('t1', ['m1'], admin)).rejects.toMatchObject({ response: { code: 'CURSO_MODIFICADO' } });
    await servicio.reordenar('t1', ['m2', 'm1'], admin);
    expect(repo.reordenar).toHaveBeenCalledWith('t1', ['m2', 'm1'], expect.anything());
  });
});
