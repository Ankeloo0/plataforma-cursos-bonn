import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion } from '../../../test/sesion';
import { catalogoService } from '../../catalogo/services/catalogo.service';
import type { Puesto } from '../../catalogo/types/catalogo.types';
import { sucursalesService } from '../../empresas/services/sucursales.service';
import type { Sucursal } from '../../empresas/types/empresas.types';
import { empleadosService } from '../services/empleados.service';
import type { Empleado } from '../types/empleados.types';
import { EmpleadoPage } from './EmpleadoPage';
import { EmpleadosPage } from './EmpleadosPage';

const auditoria = { creadoEn: '2026-10-06T20:00:00Z', creadoPor: 'Juan Pérez', actualizadoEn: '2026-10-06T20:00:00Z', actualizadoPor: null };

const empleado = (datos: Partial<Empleado> = {}): Empleado => ({
  id: 'e1',
  usuarioId: 'u1',
  numeroEmpleado: '1024',
  fechaIngreso: '2026-03-01',
  nombres: 'Ana',
  apellidoPaterno: 'Ruiz',
  apellidoMaterno: null,
  fotoUrl: null,
  activo: true,
  bloqueadoHasta: null,
  debeCambiarPassword: false,
  ultimoAccesoEn: null,
  puesto: { id: 'p1', nombre: 'Asesor de servicio' },
  area: { id: 'a1', nombre: 'Servicio' },
  sucursal: { id: 's1', nombre: 'VW Bonn Oaxaca', activo: true },
  empresa: { id: 'g1', nombre: 'Grupo Bonn' },
  marca: { id: 'm1', nombre: 'Volkswagen' },
  ...auditoria,
  ...datos,
});

const sucursal: Sucursal = {
  id: 's1',
  nombre: 'VW Bonn Oaxaca',
  direccion: null,
  activo: true,
  empresa: { id: 'g1', nombre: 'Grupo Bonn', activo: true },
  marca: { id: 'm1', nombre: 'Volkswagen' },
  administradores: [],
  empleadosActivos: 0,
  ...auditoria,
};

const puesto: Puesto = {
  id: 'p1',
  area: { id: 'a1', nombre: 'Servicio', activo: true },
  nombre: 'Asesor de servicio',
  descripcion: null,
  activo: true,
  uso: { empleados: 0, sucursales: 0, empresas: 0 },
  ...auditoria,
};

function abrir(ruta: string) {
  const router = createMemoryRouter(
    [
      { path: '/empleados', element: <EmpleadosPage /> },
      { path: '/empleados/:id', element: <EmpleadoPage /> },
    ],
    { initialEntries: [ruta] },
  );
  render(<RouterProvider router={router} />);
}

function catalogos() {
  vi.spyOn(sucursalesService, 'listarEnAlcance').mockResolvedValue([sucursal]);
  vi.spyOn(catalogoService, 'listarAreas').mockResolvedValue([]);
  vi.spyOn(catalogoService, 'listarPuestos').mockResolvedValue([puesto]);
}

const pagina = (data: Empleado[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } });

describe('Empleados', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lista empleados con su número, puesto y sucursal', async () => {
    conSesion({ rol: 'ADMIN', permisos: ['EMPLEADOS_VER', 'EMPLEADOS_GESTIONAR'] });
    catalogos();
    vi.spyOn(empleadosService, 'listar').mockResolvedValue(pagina([empleado()]));
    abrir('/empleados');

    const fila = (await screen.findByRole('link', { name: 'Ana Ruiz' })).closest('tr')!;
    expect(within(fila).getByText('No. 1024')).toBeInTheDocument();
    expect(within(fila).getByText('Asesor de servicio')).toBeInTheDocument();
    expect(within(fila).getByText('Grupo Bonn')).toBeInTheDocument();
  });

  it('con solo "Ver empleados" no ofrece dar de alta ni editar', async () => {
    conSesion({ rol: 'ADMIN', permisos: ['EMPLEADOS_VER'] });
    catalogos();
    vi.spyOn(empleadosService, 'listar').mockResolvedValue(pagina([empleado()]));
    abrir('/empleados');

    fireEvent.click(await screen.findByRole('button', { name: 'Acciones de Ana Ruiz' }));
    expect(screen.queryByRole('button', { name: 'Nuevo empleado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver ficha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('da de alta sin usuario, con empresa y número; un número repetido se marca en su campo (RF-03.1, D-34)', async () => {
    conSesion({ rol: 'ADMIN', permisos: ['EMPLEADOS_VER', 'EMPLEADOS_GESTIONAR'] });
    catalogos();
    vi.spyOn(empleadosService, 'listar').mockResolvedValue(pagina([]));
    const crear = vi.spyOn(empleadosService, 'crear').mockRejectedValueOnce({
      statusCode: 409,
      code: 'EMPLEADO_NUMERO_DUPLICADO',
      message: 'Ese número de empleado ya existe en la empresa. Revisa el número.',
    });
    abrir('/empleados');

    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo empleado' }))[0]);
    const panel = screen.getByRole('dialog', { name: 'Nuevo empleado' });
    expect(within(panel).queryByLabelText(/Usuario/)).not.toBeInTheDocument();
    // Con una sola sucursal en su alcance, ya viene elegida
    expect(within(panel).getByLabelText(/^Sucursal/)).toHaveValue('s1');

    fireEvent.change(within(panel).getByLabelText(/^Número de empleado/), { target: { value: '1024' } });
    fireEvent.change(within(panel).getByLabelText(/^Nombres/), { target: { value: 'Ana' } });
    fireEvent.change(within(panel).getByLabelText(/^Apellido paterno/), { target: { value: 'Ruiz' } });
    fireEvent.change(within(panel).getByLabelText(/^Puesto/), { target: { value: 'p1' } });
    fireEvent.change(within(panel).getByLabelText(/^Fecha de ingreso/), { target: { value: '2026-03-01' } });
    fireEvent.change(within(panel).getByLabelText(/^Contraseña temporal/), { target: { value: 'Temporal2026' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Dar de alta' }));

    expect(await within(panel).findByText('Ese número de empleado ya existe en la empresa. Revisa el número.')).toBeInTheDocument();
    expect(crear).toHaveBeenCalledWith({
      sucursalId: 's1',
      numeroEmpleado: '1024',
      nombres: 'Ana',
      apellidoPaterno: 'Ruiz',
      apellidoMaterno: null,
      puestoId: 'p1',
      fechaIngreso: '2026-03-01',
      passwordTemporal: 'Temporal2026',
    });
  });

  it('la ficha muestra datos laborales, cómo inicia sesión y quién lo dio de alta (RF-03.6)', async () => {
    conSesion({ rol: 'ADMIN', permisos: ['EMPLEADOS_VER'] });
    vi.spyOn(empleadosService, 'obtener').mockResolvedValue(empleado());
    abrir('/empleados/e1');

    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getByText('1 mar 2026')).toBeInTheDocument();
    expect(screen.getByText('Número 1024 y su contraseña')).toBeInTheDocument();
    expect(screen.getByText('por Juan Pérez')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('una ficha fuera de sus sucursales se muestra como inexistente', async () => {
    conSesion({ rol: 'ADMIN', permisos: ['EMPLEADOS_VER'] });
    vi.spyOn(empleadosService, 'obtener').mockRejectedValue({ statusCode: 404, code: 'EMPLEADO_NO_ENCONTRADO', message: 'El empleado no existe.' });
    abrir('/empleados/otro');

    expect(await screen.findByText('Este empleado no existe o no está en tus sucursales.')).toBeInTheDocument();
  });
});
