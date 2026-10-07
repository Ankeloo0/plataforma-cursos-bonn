import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion } from '../../../test/sesion';
import { catalogoService } from '../services/catalogo.service';
import type { Area, Puesto } from '../types/catalogo.types';
import { CatalogoPage } from './CatalogoPage';

const auditoria = { creadoEn: '2026-10-06T20:00:00Z', creadoPor: null, actualizadoEn: '2026-10-06T20:00:00Z', actualizadoPor: null };

const area = (datos: Partial<Area> = {}): Area => ({
  id: 'a1',
  nombre: 'Servicio',
  descripcion: null,
  activo: true,
  puestos: 1,
  puestosActivos: 1,
  uso: { empleados: 12, sucursales: 3, empresas: 2 },
  ...auditoria,
  ...datos,
});

const puesto = (datos: Partial<Puesto> = {}): Puesto => ({
  id: 'p1',
  area: { id: 'a1', nombre: 'Servicio', activo: true },
  nombre: 'Asesor de servicio',
  descripcion: null,
  activo: true,
  uso: { empleados: 1, sucursales: 1, empresas: 1 },
  ...auditoria,
  ...datos,
});

function abrir() {
  const router = createMemoryRouter([{ path: '/catalogo', element: <CatalogoPage /> }], { initialEntries: ['/catalogo'] });
  render(<RouterProvider router={router} />);
}

describe('CatalogoPage', () => {
  beforeEach(() => conSesion({ rol: 'SUPERUSUARIO', sucursales: [] }));
  afterEach(() => vi.restoreAllMocks());

  it('lista las áreas con cuántos empleados, sucursales y empresas las usan (RN-02.6)', async () => {
    vi.spyOn(catalogoService, 'listarAreas').mockResolvedValue([area(), area({ id: 'a2', nombre: 'Ventas', uso: { empleados: 0, sucursales: 0, empresas: 0 } })]);
    vi.spyOn(catalogoService, 'listarPuestos').mockResolvedValue([]);
    abrir();

    const fila = (await screen.findByText('Servicio')).closest('tr')!;
    expect(within(fila).getByText('12 empleados en 3 sucursales de 2 empresas')).toBeInTheDocument();
    expect(within(screen.getByText('Ventas').closest('tr')!).getByText('Ningún empleado activo')).toBeInTheDocument();
  });

  it('"Ver sus puestos" abre la pestaña Puestos filtrada por esa área', async () => {
    vi.spyOn(catalogoService, 'listarAreas').mockResolvedValue([area()]);
    const listarPuestos = vi.spyOn(catalogoService, 'listarPuestos').mockResolvedValue([puesto()]);
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Acciones de Servicio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver sus puestos' }));

    expect(screen.getByRole('tab', { name: 'Puestos' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Asesor de servicio')).toBeInTheDocument();
    expect(listarPuestos).toHaveBeenLastCalledWith({ search: undefined, activo: undefined, areaId: 'a1' });
  });

  it('si la API no deja desactivar, el diálogo muestra el motivo (RN-02.4)', async () => {
    vi.spyOn(catalogoService, 'listarAreas').mockResolvedValue([area()]);
    vi.spyOn(catalogoService, 'listarPuestos').mockResolvedValue([]);
    vi.spyOn(catalogoService, 'cambiarEstadoArea').mockRejectedValue({
      statusCode: 409,
      code: 'AREA_CON_PUESTOS_ACTIVOS',
      message: 'El área tiene puestos activos. Desactívalos primero.',
    });
    abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Acciones de Servicio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText(/Tiene 1 puesto activo/)).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar área' }));

    expect(await within(dialogo).findByText('El área tiene puestos activos. Desactívalos primero.')).toBeInTheDocument();
  });

  it('un nombre repetido se marca junto al campo', async () => {
    vi.spyOn(catalogoService, 'listarAreas').mockResolvedValue([]);
    vi.spyOn(catalogoService, 'listarPuestos').mockResolvedValue([]);
    vi.spyOn(catalogoService, 'crearArea').mockRejectedValue({ statusCode: 409, code: 'AREA_NOMBRE_DUPLICADO', message: 'Ya existe un área con ese nombre.' });
    abrir();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Nueva área' }))[0]);
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Servicio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear área' }));

    expect(await screen.findByText('Ya existe un área con ese nombre.')).toBeInTheDocument();
  });
});
