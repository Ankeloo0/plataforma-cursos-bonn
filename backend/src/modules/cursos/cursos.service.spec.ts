import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import type { ArchivosService } from '../archivos/archivos.service.js';
import { CursosAccesoService } from './cursos-acceso.service.js';
import type { CursosRepository } from './cursos.repository.js';
import { CursosService } from './cursos.service.js';

const admin = { id: 'a1', rol: 'ADMIN', permisos: ['CURSOS_GESTIONAR'] } as unknown as UsuarioSesion;
const superusuario = { id: 's1', rol: 'SUPERUSUARIO', permisos: [] } as unknown as UsuarioSesion;
const publicador = { id: 'a1', rol: 'ADMIN', permisos: ['CURSOS_PUBLICAR'] } as unknown as UsuarioSesion;

function cursoDe(creadoPor: string, imagenArchivoId: string | null = null, estado = 'BORRADOR') {
  return {
    id: 'c1',
    titulo: 'Curso',
    descripcion: null,
    imagenArchivoId,
    duracionHoras: '2.50',
    esObligatorio: false,
    fechaLimite: null,
    calificacionMinima: '80.00',
    estado,
    publicadoEn: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    creadoPor,
    actualizadoPor: null,
  };
}

function crear(curso = cursoDe('a1')) {
  const repo = {
    buscarPorId: vi.fn().mockResolvedValue(curso),
    buscarDetalle: vi.fn().mockResolvedValue({ curso, creadoPorNombre: 'admin', actualizadoPorNombre: null }),
    crear: vi.fn().mockResolvedValue(curso),
    actualizarSiNoCambio: vi.fn().mockResolvedValue(true),
    guardar: vi.fn(),
    cambiarEstado: vi.fn().mockResolvedValue(true),
    contarTemasVisibles: vi.fn().mockResolvedValue(2),
    temasVisiblesSinMateriales: vi.fn().mockResolvedValue([]),
    archivosDeMateriales: vi.fn().mockResolvedValue(['video', 'pdf']),
    eliminarBorrador: vi.fn().mockResolvedValue(true),
  };
  const archivos = { guardarPortada: vi.fn().mockResolvedValue({ id: 'nueva' }), eliminar: vi.fn() };
  const servicio = new CursosService(
    repo as unknown as CursosRepository,
    new CursosAccesoService(),
    archivos as unknown as ArchivosService,
  );
  return { servicio, repo, archivos };
}

describe('CursosService', () => {
  it('crea el curso en borrador con el usuario de la sesion como autor', async () => {
    const { servicio, repo } = crear();
    const respuesta = await servicio.crear(
      { titulo: 'Curso', esObligatorio: false, calificacionMinima: 80 },
      admin,
    );
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ calificacionMinima: '80', creadoPor: 'a1', fechaLimite: null }),
    );
    expect(repo.crear.mock.calls[0][0]).not.toHaveProperty('duracionHoras');
    expect(respuesta).toMatchObject({ duracionHoras: 2.5, calificacionMinima: 80, puedeEditar: true });
  });

  it('si otro guardo antes, responde 409 CURSO_MODIFICADO (V-13)', async () => {
    const { servicio, repo } = crear();
    repo.actualizarSiNoCambio.mockResolvedValue(false);
    await expect(servicio.actualizar('c1', { titulo: 'Nuevo', actualizadoEn: '2026-10-07T10:00:00.000Z' }, admin)).rejects.toMatchObject({
      response: { code: 'CURSO_MODIFICADO' },
    });
  });

  it('solo cambia los campos enviados y registra quien lo modifico', async () => {
    const { servicio, repo } = crear();
    await servicio.actualizar('c1', { titulo: 'Nuevo', actualizadoEn: '2026-10-07T10:00:00.000Z' }, admin);
    expect(repo.actualizarSiNoCambio).toHaveBeenCalledWith('c1', new Date('2026-10-07T10:00:00.000Z'), {
      titulo: 'Nuevo',
      actualizadoPor: 'a1',
    });
  });

  it('un curso de otro responde 404 y no se toca', async () => {
    const { servicio, repo } = crear(cursoDe('otro'));
    await expect(servicio.actualizar('c1', { titulo: 'X', actualizadoEn: '2026-10-07T10:00:00.000Z' }, admin)).rejects.toMatchObject({
      response: { code: 'CURSO_NO_ENCONTRADO' },
    });
    expect(repo.actualizarSiNoCambio).not.toHaveBeenCalled();
  });

  it('al cambiar la portada borra la anterior; si no se puede guardar el curso, borra la nueva', async () => {
    const { servicio, repo, archivos } = crear(cursoDe('a1', 'vieja'));
    await servicio.cambiarPortada('c1', {} as Express.Multer.File, admin);
    expect(archivos.eliminar).toHaveBeenCalledWith('vieja');

    const otro = crear(cursoDe('a1', 'vieja'));
    otro.repo.guardar.mockRejectedValue(new Error('fallo'));
    await expect(otro.servicio.cambiarPortada('c1', {} as Express.Multer.File, admin)).rejects.toThrow('fallo');
    expect(otro.archivos.eliminar).toHaveBeenCalledWith('nueva');
    expect(otro.archivos.eliminar).not.toHaveBeenCalledWith('vieja');
    expect(repo.guardar).toHaveBeenCalled();
  });

  describe('ciclo de vida (RF-04.7)', () => {
    it('el superusuario publica un borrador completo', async () => {
      const { servicio, repo } = crear();
      await servicio.publicar('c1', superusuario);
      expect(repo.cambiarEstado).toHaveBeenCalledWith('c1', 'BORRADOR', 'PUBLICADO', 's1');
    });

    it('sin temas visibles, o con un tema visible sin materiales, no se publica (RN-04.2)', async () => {
      const sinTemas = crear();
      sinTemas.repo.contarTemasVisibles.mockResolvedValue(0);
      await expect(sinTemas.servicio.publicar('c1', superusuario)).rejects.toMatchObject({ response: { code: 'CURSO_INCOMPLETO' } });

      const temaVacio = crear();
      temaVacio.repo.temasVisiblesSinMateriales.mockResolvedValue(['Bienvenida']);
      await expect(temaVacio.servicio.publicar('c1', superusuario)).rejects.toMatchObject({
        response: { code: 'CURSO_INCOMPLETO', message: expect.stringContaining('"Bienvenida"') },
      });
      expect(temaVacio.repo.cambiarEstado).not.toHaveBeenCalled();
    });

    it('el administrador que creo el curso no lo publica sin un destino de sus sucursales (V-11)', async () => {
      const { servicio, repo } = crear();
      await expect(servicio.publicar('c1', publicador)).rejects.toMatchObject({ response: { code: 'CURSO_SIN_DESTINO' } });
      await expect(servicio.reactivar('c1', publicador)).rejects.toMatchObject({ response: { code: 'CURSO_SIN_DESTINO' } });
      expect(repo.cambiarEstado).not.toHaveBeenCalled();
    });

    it('publicar uno publicado, archivar un borrador o reactivar uno publicado responde 409', async () => {
      await expect(crear(cursoDe('a1', null, 'PUBLICADO')).servicio.publicar('c1', superusuario)).rejects.toMatchObject({
        response: { code: 'CURSO_ESTADO_INVALIDO', message: 'Solo se publica un curso en borrador.' },
      });
      await expect(crear().servicio.archivar('c1', superusuario)).rejects.toMatchObject({ response: { code: 'CURSO_ESTADO_INVALIDO' } });
      await expect(crear(cursoDe('a1', null, 'PUBLICADO')).servicio.reactivar('c1', superusuario)).rejects.toMatchObject({
        response: { code: 'CURSO_ESTADO_INVALIDO' },
      });
    });

    it('si otro cambio el estado mientras tanto, responde 409', async () => {
      const { servicio, repo } = crear(cursoDe('a1', null, 'PUBLICADO'));
      repo.cambiarEstado.mockResolvedValue(false);
      await expect(servicio.archivar('c1', superusuario)).rejects.toMatchObject({ response: { code: 'CURSO_ESTADO_INVALIDO' } });
    });

    it('el creador con "Publicar cursos" archiva; sin el permiso, 403', async () => {
      const { servicio, repo } = crear(cursoDe('a1', null, 'PUBLICADO'));
      await servicio.archivar('c1', publicador);
      expect(repo.cambiarEstado).toHaveBeenCalledWith('c1', 'PUBLICADO', 'ARCHIVADO', 'a1');
      await expect(servicio.archivar('c1', admin)).rejects.toMatchObject({ response: { code: 'CURSO_NO_EDITABLE' } });
    });

    it('reactivar vuelve a validar el contenido', async () => {
      const { servicio, repo } = crear(cursoDe('a1', null, 'ARCHIVADO'));
      repo.contarTemasVisibles.mockResolvedValue(0);
      await expect(servicio.reactivar('c1', superusuario)).rejects.toMatchObject({ response: { code: 'CURSO_INCOMPLETO' } });

      repo.contarTemasVisibles.mockResolvedValue(1);
      await servicio.reactivar('c1', superusuario);
      expect(repo.cambiarEstado).toHaveBeenCalledWith('c1', 'ARCHIVADO', 'PUBLICADO', 's1');
    });

    it('al eliminar un borrador borra los archivos de sus materiales y su portada despues del curso (RN-04.4)', async () => {
      const { servicio, repo, archivos } = crear(cursoDe('a1', 'portada'));
      await servicio.eliminar('c1', admin);
      expect(archivos.eliminar.mock.calls.map((c) => c[0])).toEqual(['video', 'pdf', 'portada']);
      expect(archivos.eliminar.mock.invocationCallOrder[0]).toBeGreaterThan(repo.eliminarBorrador.mock.invocationCallOrder[0]);
    });

    it('un curso publicado no se elimina y sus archivos no se tocan', async () => {
      const { servicio, repo, archivos } = crear(cursoDe('a1', null, 'PUBLICADO'));
      await expect(servicio.eliminar('c1', admin)).rejects.toMatchObject({ response: { code: 'CURSO_NO_ES_BORRADOR' } });
      expect(repo.eliminarBorrador).not.toHaveBeenCalled();
      expect(archivos.eliminar).not.toHaveBeenCalled();
    });

    it('la respuesta dice que acciones tiene quien consulta', async () => {
      expect(await crear().servicio.obtener('c1', publicador)).toMatchObject({ puedeEditar: false, puedePublicar: false, puedeArchivar: true });
      expect(await crear().servicio.obtener('c1', superusuario)).toMatchObject({ puedeEditar: true, puedePublicar: true, puedeArchivar: true });
    });
  });
});
