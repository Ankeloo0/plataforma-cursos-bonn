import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import type { ArchivosService } from '../archivos/archivos.service.js';
import { CursosAccesoService } from './cursos-acceso.service.js';
import type { CursosRepository } from './cursos.repository.js';
import { CursosService } from './cursos.service.js';

const admin = { id: 'a1', rol: 'ADMIN', permisos: ['CURSOS_GESTIONAR'] } as unknown as UsuarioSesion;

function cursoDe(creadoPor: string, imagenArchivoId: string | null = null) {
  return {
    id: 'c1',
    titulo: 'Curso',
    descripcion: null,
    imagenArchivoId,
    duracionHoras: '2.50',
    esObligatorio: false,
    fechaLimite: null,
    calificacionMinima: '80.00',
    estado: 'BORRADOR',
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
});
