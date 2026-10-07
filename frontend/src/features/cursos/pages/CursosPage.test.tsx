import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion } from '../../../test/sesion';
import { cursosService } from '../services/cursos.service';
import type { Curso } from '../types/cursos.types';
import { CursosPage } from './CursosPage';

const curso = (datos: Partial<Curso> = {}): Curso => ({
  id: 'c1',
  titulo: 'Atención al cliente',
  descripcion: null,
  portadaUrl: null,
  duracionHoras: 1.42,
  esObligatorio: true,
  fechaLimite: '2026-12-15',
  calificacionMinima: 80,
  estado: 'BORRADOR',
  publicadoEn: null,
  puedeEditar: true,
  creadoEn: '2026-10-07T20:00:00Z',
  creadoPor: 'jperez Juan Pérez',
  actualizadoEn: '2026-10-07T20:00:00.123Z',
  actualizadoPor: null,
  ...datos,
});

const pagina = (data: Curso[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } });

function abrir(ruta = '/cursos') {
  const router = createMemoryRouter([{ path: '/cursos', element: <CursosPage /> }], { initialEntries: [ruta] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('Cursos', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra cada curso con su estado, duración, obligatorio y fecha límite', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'listar').mockResolvedValue(pagina([curso()]));
    abrir();

    const tarjeta = (await screen.findByRole('heading', { name: 'Atención al cliente' })).closest('article')!;
    expect(within(tarjeta).getByText('Borrador')).toBeInTheDocument();
    expect(within(tarjeta).getByText('1 h 25 min')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Obligatorio')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Vence 15 dic 2026')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Cursos')).toBeInTheDocument();
  });

  it('sin "Gestionar cursos" no ofrece crear ni editar; sin videos lo indica en lugar de la duración', async () => {
    conSesion({ permisos: ['CURSOS_ASIGNAR'] });
    vi.spyOn(cursosService, 'listar').mockResolvedValue(pagina([curso({ puedeEditar: false, duracionHoras: 0 })]));
    abrir();

    expect(await screen.findByText('Solo consulta')).toBeInTheDocument();
    expect(screen.getByText('Sin videos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo curso' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });

  it('el filtro de estado vive en la URL y se envía a la API', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    const listar = vi.spyOn(cursosService, 'listar').mockResolvedValue(pagina([curso()]));
    const router = abrir();
    await screen.findByRole('heading', { name: 'Atención al cliente' });

    fireEvent.click(screen.getByRole('button', { name: 'Publicados' }));

    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'PUBLICADO', page: 1 })));
    expect(router.state.location.search).toBe('?estado=PUBLICADO');
  });

  it('crea un curso sin capturar la duración, con la calificación en coma decimal', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'listar').mockResolvedValue(pagina([]));
    const crear = vi.spyOn(cursosService, 'crear').mockResolvedValue(curso());
    abrir();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo curso' }))[0]);
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Garantías' } });
    expect(screen.queryByLabelText(/Duración/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Calificación mínima/), { target: { value: '85,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear curso' }));

    await waitFor(() =>
      expect(crear).toHaveBeenCalledWith({
        titulo: 'Garantías',
        descripcion: null,
        esObligatorio: false,
        fechaLimite: null,
        calificacionMinima: 85.5,
      }),
    );
  });

  it('al editar envía el actualizadoEn que leyó y muestra el aviso si otro guardó antes (V-13)', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'listar').mockResolvedValue(pagina([curso()]));
    const actualizar = vi.spyOn(cursosService, 'actualizar').mockRejectedValue({
      statusCode: 409,
      code: 'CURSO_MODIFICADO',
      message: 'Este curso cambió mientras lo editabas. Recarga para ver los cambios.',
    });
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Atención al cliente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Este curso cambió mientras lo editabas. Recarga para ver los cambios.')).toBeInTheDocument();
    expect(actualizar).toHaveBeenCalledWith('c1', expect.objectContaining({ titulo: 'Atención al cliente' }), '2026-10-07T20:00:00.123Z');
  });
});
