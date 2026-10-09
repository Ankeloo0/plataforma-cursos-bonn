import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion } from '../../../test/sesion';
import { contenidoService } from '../services/contenido.service';
import { cursosService } from '../services/cursos.service';
import type { Material, Tema } from '../types/contenido.types';
import type { Curso } from '../types/cursos.types';
import { EditorCursoPage } from './EditorCursoPage';

const curso = (datos: Partial<Curso> = {}): Curso => ({
  id: 'c1',
  titulo: 'Seguridad en el taller',
  descripcion: null,
  portadaUrl: null,
  duracionHoras: 1.42,
  esObligatorio: false,
  fechaLimite: null,
  calificacionMinima: 80,
  estado: 'BORRADOR',
  publicadoEn: null,
  puedeEditar: true,
  creadoEn: '2026-10-08T15:00:00Z',
  creadoPor: 'jperez Juan Pérez',
  actualizadoEn: '2026-10-08T15:00:00.123Z',
  actualizadoPor: null,
  ...datos,
});

const material = (datos: Partial<Material>): Material => ({
  id: 'm1',
  temaId: 't1',
  titulo: 'Material',
  descripcion: null,
  tipo: 'PDF',
  orden: 1,
  activo: true,
  duracionSegundos: 0,
  archivo: null,
  urlExterna: null,
  actualizadoEn: '2026-10-08T15:00:00Z',
  ...datos,
});

const archivo = (tamanoBytes: number) => ({
  id: 'a1',
  url: '/api/v1/archivos/a1/contenido',
  nombreOriginal: 'archivo',
  mimeType: 'application/pdf',
  tamanoBytes,
  estado: 'LISTO' as const,
});

const temas = (): Tema[] => [
  {
    id: 't1',
    cursoId: 'c1',
    titulo: 'Introducción',
    descripcion: null,
    orden: 1,
    activo: true,
    actualizadoEn: '2026-10-08T15:00:00Z',
    materiales: [
      material({ id: 'm1', tipo: 'VIDEO', titulo: 'Bienvenida', duracionSegundos: 720, archivo: archivo(80 * 1024 * 1024) }),
      material({ id: 'm2', tipo: 'PDF', titulo: 'Reglamento', archivo: archivo(2.3 * 1024 * 1024) }),
      material({ id: 'm3', tipo: 'ENLACE', titulo: 'Manual', urlExterna: 'https://www.vw.com.mx/manual', activo: false }),
    ],
  },
  { id: 't2', cursoId: 'c1', titulo: 'Equipo de protección', descripcion: null, orden: 2, activo: true, actualizadoEn: '2026-10-08T15:00:00Z', materiales: [] },
];

function abrir() {
  const router = createMemoryRouter([{ path: '/cursos/:id/editar', element: <EditorCursoPage /> }], {
    initialEntries: ['/cursos/c1/editar'],
  });
  render(<RouterProvider router={router} />);
}

describe('Editor de contenido del curso', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra el plan de estudios con el dato de cada material y la duración del curso', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    abrir();

    const plan = await screen.findByRole('list', { name: 'Temas del curso' });
    expect(within(plan).getByRole('heading', { name: 'Introducción' })).toBeInTheDocument();
    expect(screen.getByText('Video · 12 min')).toBeInTheDocument();
    expect(screen.getByText('PDF · 2.3 MB')).toBeInTheDocument();
    expect(screen.getByText('Enlace · vw.com.mx')).toBeInTheDocument();
    expect(screen.getByText('Oculto')).toBeInTheDocument();
    expect(screen.getByText('Sin materiales')).toBeInTheDocument();
    expect(screen.getByText('1 h 25 min')).toBeInTheDocument();
    expect(screen.getByText('2 temas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover el tema 1, Introducción' })).toBeInTheDocument();
  });

  it('sin permiso de edición se consulta sin asas, sin menús de edición ni botón para agregar', async () => {
    conSesion({ permisos: ['CURSOS_ASIGNAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso({ puedeEditar: false }));
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    abrir();

    expect(await screen.findByText('Solo consulta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar tema' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Datos del curso' })).not.toBeInTheDocument();
  });

  it('un curso sin temas invita a agregar el primero', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso({ duracionHoras: 0 }));
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue([]);
    const crearTema = vi.spyOn(contenidoService, 'crearTema').mockResolvedValue(temas()[1]);
    abrir();

    expect(await screen.findByText('Este curso todavía no tiene temas')).toBeInTheDocument();
    expect(screen.getByText('Sin duración')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar tema' }));
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Introducción' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Agregar tema' }));

    await waitFor(() => expect(crearTema).toHaveBeenCalledWith('c1', { titulo: 'Introducción', descripcion: null }));
  });

  it('agrega un PDF: la subida empieza al elegirlo y el título sale del nombre del archivo', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    const subir = vi.spyOn(contenidoService, 'subirArchivo').mockImplementation(async (_archivo, alAvanzar) => {
      alAvanzar(100);
      return { id: 'nuevo', nombreOriginal: 'Guia de frenos.pdf', mimeType: 'application/pdf', tamanoBytes: 1024, tipoMaterial: 'PDF' };
    });
    const crear = vi.spyOn(contenidoService, 'crearMaterial').mockResolvedValue(material({}));
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar material al tema 2' }));
    const panel = screen.getByRole('dialog', { name: 'Nuevo material' });
    fireEvent.click(within(panel).getByRole('radio', { name: /PDF/ }));
    const entrada = panel.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [new File(['%PDF'], 'Guia de frenos.pdf', { type: 'application/pdf' })] } });

    expect(await within(panel).findByText('Subido · 1 KB')).toBeInTheDocument();
    expect(subir).toHaveBeenCalled();
    expect(within(panel).getByLabelText(/Título/)).toHaveValue('Guia de frenos');
    fireEvent.click(within(panel).getByRole('button', { name: 'Agregar material' }));

    await waitFor(() =>
      expect(crear).toHaveBeenCalledWith('t2', 'PDF', { titulo: 'Guia de frenos', descripcion: null, archivoId: 'nuevo' }),
    );
  });

  it('no deja guardar mientras sube y pide confirmar antes de cerrar el panel', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    vi.spyOn(contenidoService, 'subirArchivo').mockImplementation((_archivo, alAvanzar) => {
      alAvanzar(45);
      return new Promise(() => undefined);
    });
    const crear = vi.spyOn(contenidoService, 'crearMaterial');
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar material al tema 1' }));
    const panel = screen.getByRole('dialog', { name: 'Nuevo material' });
    fireEvent.click(within(panel).getByRole('radio', { name: /Video/ }));
    const entrada = panel.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [new File(['video'], 'bienvenida.mp4', { type: 'video/mp4' })] } });

    expect(await within(panel).findByRole('progressbar', { name: 'Subiendo bienvenida.mp4' })).toHaveAttribute('aria-valuenow', '45');
    fireEvent.click(within(panel).getByRole('button', { name: 'Agregar material' }));
    expect(crear).not.toHaveBeenCalled();

    fireEvent.click(within(panel).getByRole('button', { name: 'Cerrar' }));
    expect(await screen.findByRole('dialog', { name: '¿Cancelar la subida?' })).toBeInTheDocument();
  });

  it('rechaza antes de subir un archivo que pasa el límite de su tipo', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    const subir = vi.spyOn(contenidoService, 'subirArchivo');
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar material al tema 1' }));
    const panel = screen.getByRole('dialog', { name: 'Nuevo material' });
    fireEvent.click(within(panel).getByRole('radio', { name: /PDF/ }));
    const grande = new File(['x'], 'enorme.pdf', { type: 'application/pdf' });
    Object.defineProperty(grande, 'size', { value: 60 * 1024 * 1024 });
    fireEvent.change(panel.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [grande] } });

    expect(await within(panel).findByText('El archivo pesa más de 50 MB, el máximo para este tipo.')).toBeInTheDocument();
    expect(subir).not.toHaveBeenCalled();
  });

  it('al editar los datos del curso envía el actualizadoEn que leyó y muestra el aviso si otro guardó antes (V-13)', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    const actualizar = vi.spyOn(cursosService, 'actualizar').mockRejectedValue({
      statusCode: 409,
      code: 'CURSO_MODIFICADO',
      message: 'Este curso cambió mientras lo editabas. Recarga para ver los cambios.',
    });
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Datos del curso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Este curso cambió mientras lo editabas. Recarga para ver los cambios.')).toBeInTheDocument();
    expect(actualizar).toHaveBeenCalledWith('c1', expect.objectContaining({ titulo: 'Seguridad en el taller' }), '2026-10-08T15:00:00.123Z');
  });

  it('si una acción del menú falla, lo avisa con la opción de recargar', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    vi.spyOn(contenidoService, 'cambiarVisibilidadTema').mockRejectedValue({ statusCode: 409, message: 'Este curso cambió mientras lo editabas.' });
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Acciones del tema Introducción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));

    expect(await screen.findByText('Este curso cambió mientras lo editabas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });
});
