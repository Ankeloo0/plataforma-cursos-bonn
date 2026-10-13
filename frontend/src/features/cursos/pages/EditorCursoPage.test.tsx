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
  puedePublicar: false,
  puedeArchivar: false,
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
  contenido: null,
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
      material({
        id: 'm4',
        tipo: 'ARTICULO',
        titulo: 'Recepción del vehículo',
        duracionSegundos: 240,
        contenido: '<h2>Antes de empezar</h2><p>Saluda al cliente y revisa la orden.</p><ul><li>Kilometraje</li></ul>',
      }),
    ],
  },
  { id: 't2', cursoId: 'c1', titulo: 'Equipo de protección', descripcion: null, orden: 2, activo: true, actualizadoEn: '2026-10-08T15:00:00Z', materiales: [] },
];

function abrir() {
  const router = createMemoryRouter(
    [
      { path: '/cursos/:id/editar', element: <EditorCursoPage /> },
      { path: '/cursos/:id/vista-previa', element: <p>Pantalla de vista previa</p> },
      { path: '/cursos', element: <p>Listado de cursos</p> },
    ],
    { initialEntries: ['/cursos/c1/editar'] },
  );
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
    expect(screen.getByText('Artículo · 4 min')).toBeInTheDocument();
    expect(screen.getByText('Oculto')).toBeInTheDocument();
    expect(screen.getByText('Sin materiales')).toBeInTheDocument();
    expect(screen.getByText('1 h 25 min')).toBeInTheDocument();
    expect(screen.getByText('2 temas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover el tema 1, Introducción' })).toBeInTheDocument();
  });

  it('mientras un video se comprime revisa el plan cada 5 s y quita "Procesando" al terminar (RF-04.6)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    const procesando = temas();
    procesando[0].materiales[0].archivo = { ...archivo(80 * 1024 * 1024), estado: 'PROCESANDO' };
    const listarTemas = vi.spyOn(contenidoService, 'listarTemas').mockResolvedValueOnce(procesando).mockResolvedValue(temas());
    abrir();

    expect(await screen.findByText('Procesando')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(5000);
    await waitFor(() => expect(screen.queryByText('Procesando')).not.toBeInTheDocument());
    expect(listarTemas).toHaveBeenCalledTimes(2);

    // Sin videos en proceso ya no vuelve a pedir el plan
    await vi.advanceTimersByTimeAsync(15000);
    expect(listarTemas).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
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

  it('un artículo nuevo no se guarda sin texto y el panel se ensancha para escribirlo', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    const crear = vi.spyOn(contenidoService, 'crearMaterial');
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar material al tema 2' }));
    const panel = screen.getByRole('dialog', { name: 'Nuevo material' });
    fireEvent.click(within(panel).getByRole('radio', { name: /Artículo/ }));

    expect(within(panel).getByRole('toolbar', { name: 'Formato del artículo' })).toBeInTheDocument();
    expect(panel.querySelector('[data-panel-amplio]')).not.toBeNull();
    expect(within(panel).getByText('Sin texto todavía')).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText(/Título/), { target: { value: 'Recepción' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Agregar material' }));

    expect(await within(panel).findByText('Escribe el contenido del artículo.')).toBeInTheDocument();
    expect(crear).not.toHaveBeenCalled();
  });

  it('al editar un artículo muestra su formato y envía su contenido', async () => {
    conSesion({ permisos: ['CURSOS_GESTIONAR'] });
    vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
    vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
    const actualizar = vi.spyOn(contenidoService, 'actualizarMaterial').mockResolvedValue(material({}));
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Acciones de Recepción del vehículo' }));
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar material' }));
    const panel = screen.getByRole('dialog', { name: 'Editar material' });

    expect(within(panel).getByRole('heading', { level: 2, name: 'Antes de empezar' })).toBeInTheDocument();
    expect(within(panel).getByText('Kilometraje')).toBeInTheDocument();
    expect(within(panel).getByText('11 palabras · 1 min de lectura')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(actualizar).toHaveBeenCalledWith(
        'm4',
        expect.objectContaining({ titulo: 'Recepción del vehículo', contenido: expect.stringContaining('<h2>Antes de empezar</h2>') }),
        '2026-10-08T15:00:00Z',
      ),
    );
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

  describe('ciclo de vida (HU-17)', () => {
    const menuDelCurso = () => screen.getByRole('button', { name: 'Más acciones del curso' });

    it('publica un borrador y vuelve a pedir el curso para mostrar su estado', async () => {
      conSesion({ rol: 'SUPERUSUARIO' });
      const obtener = vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso({ puedePublicar: true, puedeArchivar: true }));
      vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
      const publicar = vi.spyOn(cursosService, 'publicar').mockResolvedValue(curso({ estado: 'PUBLICADO' }));
      abrir();

      fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
      expect(publicar).toHaveBeenCalledWith('c1');
      await waitFor(() => expect(obtener).toHaveBeenCalledTimes(2));
    });

    it('si falta contenido muestra el motivo de la API', async () => {
      conSesion({ rol: 'SUPERUSUARIO' });
      vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso({ puedePublicar: true }));
      vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
      vi.spyOn(cursosService, 'publicar').mockRejectedValue({
        statusCode: 422,
        code: 'CURSO_INCOMPLETO',
        message: 'Cada tema visible necesita al menos un material visible. Revisa: "Equipo de protección".',
      });
      abrir();

      fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
      expect(await screen.findByText(/Revisa: "Equipo de protección"/)).toBeInTheDocument();
    });

    it('sin permiso para publicar no ve el botón, pero sí la vista previa', async () => {
      conSesion({ permisos: ['CURSOS_GESTIONAR', 'CURSOS_PUBLICAR'] });
      vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso({ puedePublicar: false, puedeArchivar: true }));
      vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
      abrir();

      fireEvent.click(await screen.findByRole('button', { name: 'Vista previa' }));
      expect(await screen.findByText('Pantalla de vista previa')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
    });

    it('archiva un curso publicado después de confirmar', async () => {
      conSesion({ rol: 'SUPERUSUARIO' });
      vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso({ estado: 'PUBLICADO', puedePublicar: true, puedeArchivar: true }));
      vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
      const archivar = vi.spyOn(cursosService, 'archivar').mockResolvedValue(curso({ estado: 'ARCHIVADO' }));
      abrir();

      await screen.findByText('Seguridad en el taller', { selector: 'h1' });
      expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
      fireEvent.click(menuDelCurso());
      fireEvent.click(screen.getByRole('button', { name: 'Archivar curso' }));
      const dialogo = screen.getByRole('dialog', { name: '¿Archivar el curso?' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Archivar curso' }));

      await waitFor(() => expect(archivar).toHaveBeenCalledWith('c1'));
    });

    it('reactiva un curso archivado', async () => {
      conSesion({ rol: 'SUPERUSUARIO' });
      vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso({ estado: 'ARCHIVADO', puedePublicar: true, puedeArchivar: true }));
      vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
      const reactivar = vi.spyOn(cursosService, 'reactivar').mockResolvedValue(curso({ estado: 'PUBLICADO' }));
      abrir();

      await screen.findByText('Seguridad en el taller', { selector: 'h1' });
      fireEvent.click(menuDelCurso());
      fireEvent.click(screen.getByRole('button', { name: 'Reactivar curso' }));
      await waitFor(() => expect(reactivar).toHaveBeenCalledWith('c1'));
    });

    it('elimina un borrador después de confirmar y vuelve al listado', async () => {
      conSesion({ permisos: ['CURSOS_GESTIONAR'] });
      vi.spyOn(cursosService, 'obtener').mockResolvedValue(curso());
      vi.spyOn(contenidoService, 'listarTemas').mockResolvedValue(temas());
      const eliminar = vi.spyOn(cursosService, 'eliminar').mockResolvedValue();
      abrir();

      await screen.findByText('Seguridad en el taller', { selector: 'h1' });
      fireEvent.click(menuDelCurso());
      fireEvent.click(screen.getByRole('button', { name: 'Eliminar borrador' }));
      fireEvent.click(within(screen.getByRole('dialog', { name: '¿Eliminar el borrador?' })).getByRole('button', { name: 'Eliminar borrador' }));

      expect(await screen.findByText('Listado de cursos')).toBeInTheDocument();
      expect(eliminar).toHaveBeenCalledWith('c1');
    });
  });
});
