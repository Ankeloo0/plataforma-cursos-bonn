import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion } from '../../../test/sesion';
import { contenidoService } from '../services/contenido.service';
import { cursosService } from '../services/cursos.service';
import type { Material, Tema } from '../types/contenido.types';
import type { Curso } from '../types/cursos.types';
import { VistaPreviaCursoPage } from './VistaPreviaCursoPage';

const curso: Curso = {
  id: 'c1',
  titulo: 'Seguridad en el taller',
  descripcion: 'Lo básico para trabajar seguro.',
  portadaUrl: null,
  duracionHoras: 0.25,
  esObligatorio: true,
  fechaLimite: null,
  calificacionMinima: 80,
  estado: 'BORRADOR',
  publicadoEn: null,
  puedeEditar: true,
  puedePublicar: true,
  puedeArchivar: true,
  creadoEn: '2026-10-08T15:00:00Z',
  creadoPor: 'jperez Juan Pérez',
  actualizadoEn: '2026-10-08T15:00:00Z',
  actualizadoPor: null,
};

const material = (datos: Partial<Material>): Material => ({
  id: 'm1',
  temaId: 't1',
  titulo: 'Material',
  descripcion: null,
  tipo: 'ENLACE',
  orden: 1,
  activo: true,
  duracionSegundos: 0,
  archivo: null,
  urlExterna: null,
  contenido: null,
  actualizadoEn: '2026-10-08T15:00:00Z',
  ...datos,
});

const tema = (datos: Partial<Tema>): Tema => ({
  id: 't1',
  cursoId: 'c1',
  titulo: 'Tema',
  descripcion: null,
  orden: 1,
  activo: true,
  actualizadoEn: '2026-10-08T15:00:00Z',
  materiales: [],
  ...datos,
});

const temas = (): Tema[] => [
  tema({
    id: 't1',
    titulo: 'Introducción',
    materiales: [
      material({
        id: 'm1',
        tipo: 'ARTICULO',
        titulo: 'Antes de empezar',
        duracionSegundos: 240,
        descripcion: 'Lee esto primero.',
        contenido: '<h2>Equipo</h2><p>Usa lentes de seguridad.</p>',
      }),
      material({ id: 'm2', titulo: 'Borrador interno', activo: false, urlExterna: 'https://ejemplo.com' }),
      material({ id: 'm3', titulo: 'Manual de VW', urlExterna: 'https://www.vw.com.mx/manual' }),
    ],
  }),
  tema({ id: 't2', titulo: 'Tema oculto', activo: false, materiales: [material({ id: 'm4', titulo: 'No se ve' })] }),
  tema({ id: 't3', titulo: 'Herramientas', materiales: [material({ id: 'm5', titulo: 'Catálogo', urlExterna: 'https://www.vw.com.mx/catalogo' })] }),
];

function abrir() {
  const router = createMemoryRouter([{ path: '/cursos/:id/vista-previa', element: <VistaPreviaCursoPage /> }], {
    initialEntries: ['/cursos/c1/vista-previa'],
  });
  render(<RouterProvider router={router} />);
}

describe('Vista previa del curso (HU-16)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra solo lo visible, empezando por el primer material, y avisa que no registra avance', async () => {
    conSesion({ rol: 'SUPERUSUARIO' });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso);
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    abrir();

    expect(await screen.findByRole('heading', { name: 'Antes de empezar' })).toBeInTheDocument();
    expect(screen.getByText(/Aquí no se registra avance/)).toBeInTheDocument();
    expect(screen.getByText('Obligatorio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equipo' })).toBeInTheDocument();
    expect(screen.getByText('Material 1 de 2 · Artículo · 4 min')).toBeInTheDocument();

    const navegacion = screen.getByRole('navigation', { name: 'Temas del curso' });
    expect(within(navegacion).queryByText('Tema oculto')).not.toBeInTheDocument();
    expect(within(navegacion).queryByText('Borrador interno')).not.toBeInTheDocument();
    expect(within(navegacion).getByRole('button', { name: /Introducción/ })).toHaveAttribute('aria-current', 'step');
  });

  it('"Siguiente material" recorre el curso y pasa al tema siguiente', async () => {
    conSesion({ rol: 'SUPERUSUARIO' });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso);
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    abrir();

    await screen.findByRole('heading', { name: 'Antes de empezar' });
    expect(screen.queryByRole('button', { name: 'Material anterior' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente material' }));
    expect(screen.getByRole('heading', { name: 'Manual de VW' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir enlace (se abre en otra pestaña)' })).toHaveAttribute('href', 'https://www.vw.com.mx/manual');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente material' }));
    expect(screen.getByRole('heading', { name: 'Tema 2 · Herramientas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Siguiente material' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Antes de empezar' }));
    expect(screen.getByRole('heading', { name: 'Antes de empezar' })).toBeInTheDocument();
  });

  it('cada tema se despliega y se pliega para mostrar sus materiales', async () => {
    conSesion({ rol: 'SUPERUSUARIO' });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso);
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    abrir();

    await screen.findByRole('heading', { name: 'Antes de empezar' });
    const navegacion = screen.getByRole('navigation', { name: 'Temas del curso' });
    const introduccion = within(navegacion).getByRole('button', { name: /1\. Introducción/ });
    const herramientas = within(navegacion).getByRole('button', { name: /2\. Herramientas/ });
    expect(introduccion).toHaveAttribute('aria-expanded', 'true');
    expect(herramientas).toHaveAttribute('aria-expanded', 'false');
    expect(within(navegacion).queryByRole('button', { name: 'Catálogo' })).not.toBeInTheDocument();

    fireEvent.click(herramientas);
    expect(herramientas).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(navegacion).getByRole('button', { name: 'Catálogo' }));
    expect(screen.getByRole('heading', { name: 'Tema 2 · Herramientas' })).toBeInTheDocument();

    fireEvent.click(introduccion);
    expect(introduccion).toHaveAttribute('aria-expanded', 'false');
    expect(within(navegacion).queryByRole('button', { name: 'Antes de empezar' })).not.toBeInTheDocument();
  });

  it('sin contenido visible invita a volver al editor', async () => {
    conSesion({ rol: 'SUPERUSUARIO' });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso);
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue([tema({ activo: false })]);
    abrir();

    expect(await screen.findByText('Este curso todavía no tiene contenido visible')).toBeInTheDocument();
  });

  it('un curso que no puede ver responde como si no existiera', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockRejectedValue({ statusCode: 404, message: 'El curso no existe.' });
    vi.spyOn(contenidoService, 'listarTemas').mockRejectedValue({ statusCode: 404, message: 'El curso no existe.' });
    abrir();

    expect(await screen.findByText('Este curso no existe o no puedes verlo.')).toBeInTheDocument();
  });
});
