import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion } from '../../../test/sesion';
import { authService } from '../../auth/services/auth.service';
import { sucursalesService } from '../../empresas/services/sucursales.service';
import type { Sucursal } from '../../empresas/types/empresas.types';
import { administradoresService } from '../services/administradores.service';
import type { AdministradorDetalle, AdministradorResumen, CatalogoPermisos } from '../types/administradores.types';
import { AdministradorPage } from './AdministradorPage';
import { AdministradoresPage } from './AdministradoresPage';

const cuenta = {
  id: 'a1',
  rol: 'ADMIN',
  empresaId: 'e1',
  numeroEmpleado: 'A-100',
  nombres: 'Juan',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: null,
  fotoUrl: null,
  activo: true,
  bloqueadoHasta: null,
  debeCambiarPassword: false,
  ultimoAccesoEn: null,
  creadoEn: '2026-10-02T20:00:00Z',
  actualizadoEn: '2026-10-02T20:00:00Z',
};

const resumen = (datos: Partial<AdministradorResumen> = {}): AdministradorResumen => ({
  ...cuenta,
  empresa: { id: 'e1', nombre: 'Grupo Bonn' },
  totalPermisos: 3,
  totalSucursales: 2,
  ...datos,
});

const detalle = (datos: Partial<AdministradorDetalle> = {}): AdministradorDetalle => ({
  ...cuenta,
  empresa: { id: 'e1', nombre: 'Grupo Bonn' },
  permisos: [],
  sucursales: [],
  ...datos,
});

const catalogo: CatalogoPermisos = {
  permisos: [
    { permiso: 'MARCAS_GESTIONAR', grupo: 'CATALOGOS', nombre: 'Gestionar marcas', descripcion: 'Crear y editar marcas.', alcance: 'TODA_LA_PLATAFORMA' },
    { permiso: 'EMPLEADOS_VER', grupo: 'EMPLEADOS', nombre: 'Ver empleados', descripcion: 'Ver empleados.', alcance: 'SUS_SUCURSALES' },
    { permiso: 'REPORTES_VER', grupo: 'RESULTADOS', nombre: 'Ver reportes', descripcion: 'Dashboard y reportes.', alcance: 'SUS_SUCURSALES' },
  ],
  plantillas: [{ clave: 'SOLO_REPORTES', nombre: 'Solo reportes', permisos: ['REPORTES_VER'] }],
};

const sucursal = (id: string, nombre: string, empresa: string): Sucursal => ({
  id,
  nombre,
  direccion: null,
  activo: true,
  empresa: { id: `e-${empresa}`, nombre: empresa, activo: true },
  marca: { id: 'm1', nombre: 'Volkswagen' },
  administradores: [],
  empleadosActivos: 0,
  creadoEn: '2026-10-02T20:00:00Z',
  creadoPor: null,
  actualizadoEn: '2026-10-02T20:00:00Z',
  actualizadoPor: null,
});

function abrir(ruta: string) {
  const router = createMemoryRouter(
    [
      { path: '/administradores', element: <AdministradoresPage /> },
      { path: '/administradores/:id', element: <AdministradorPage /> },
    ],
    { initialEntries: [ruta] },
  );
  render(<RouterProvider router={router} />);
}

describe('Administradores y permisos', () => {
  beforeEach(() => conSesion({ rol: 'SUPERUSUARIO', sucursales: [] }));
  afterEach(() => vi.restoreAllMocks());

  it('lista los administradores con su número, su empresa y un resumen de su acceso', async () => {
    vi.spyOn(administradoresService, 'listar').mockResolvedValue({
      data: [
        resumen(),
        resumen({ id: 'a2', nombres: 'Ana', empresaId: null, numeroEmpleado: null, empresa: null, totalPermisos: 0, totalSucursales: 0 }),
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    abrir('/administradores');

    const fila = (await screen.findByRole('link', { name: 'Juan Pérez' })).closest('tr')!;
    expect(within(fila).getByText('3 permisos · 2 sucursales')).toBeInTheDocument();
    expect(within(fila).getByText('No. A-100')).toBeInTheDocument();
    expect(fila).toHaveTextContent('Grupo Bonn');
    const filaAna = screen.getByRole('link', { name: 'Ana Pérez' }).closest('tr')!;
    expect(within(filaAna).getByText('Sin permisos')).toBeInTheDocument();
    expect(within(filaAna).getByText('Sin número de empleado')).toBeInTheDocument();
  });

  it('da de alta con empresa y número de empleado, que son sus datos de acceso', async () => {
    vi.spyOn(administradoresService, 'listar').mockResolvedValue({ data: [resumen()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    vi.spyOn(authService, 'listarEmpresas').mockResolvedValue([
      { id: 'e1', nombre: 'Grupo Bonn' },
      { id: 'e2', nombre: 'Grupo Bonn Dorada' },
    ]);
    vi.spyOn(administradoresService, 'obtener').mockResolvedValue(detalle({ id: 'a9' }));
    vi.spyOn(administradoresService, 'catalogo').mockResolvedValue(catalogo);
    vi.spyOn(sucursalesService, 'listarEnAlcance').mockResolvedValue([]);
    const crear = vi.spyOn(administradoresService, 'crear').mockResolvedValue({ ...cuenta, id: 'a9' });
    abrir('/administradores');

    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo administrador' }))[0]);
    fireEvent.change(await screen.findByLabelText(/^Nombres/), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/^Apellido paterno/), { target: { value: 'Mora' } });
    fireEvent.change(screen.getByLabelText(/^Empresa/), { target: { value: 'e2' } });
    fireEvent.change(screen.getByLabelText(/^Número de empleado/), { target: { value: 'D-7' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña temporal/), { target: { value: 'Temporal2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear administrador' }));

    await screen.findByText(/no puede hacer nada todavía/);
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ empresaId: 'e2', numeroEmpleado: 'D-7', passwordTemporal: 'Temporal2026' }));
  });

  it('un administrador nuevo empieza sin permisos y la pantalla lo avisa', async () => {
    vi.spyOn(administradoresService, 'obtener').mockResolvedValue(detalle());
    vi.spyOn(administradoresService, 'catalogo').mockResolvedValue(catalogo);
    vi.spyOn(sucursalesService, 'listarEnAlcance').mockResolvedValue([sucursal('s1', 'VW Bonn Oaxaca', 'Grupo Bonn')]);
    abrir('/administradores/a1');

    expect(await screen.findByText(/no puede hacer nada todavía/)).toBeInTheDocument();
    expect(screen.getByText('0 permisos · 0 sucursales')).toBeInTheDocument();
  });

  it('marca permisos con una plantilla y casillas, elige sucursales agrupadas por empresa y guarda todo junto (RF-00.8)', async () => {
    vi.spyOn(administradoresService, 'obtener').mockResolvedValue(detalle());
    vi.spyOn(administradoresService, 'catalogo').mockResolvedValue(catalogo);
    vi.spyOn(sucursalesService, 'listarEnAlcance').mockResolvedValue([
      sucursal('s1', 'VW Bonn Oaxaca', 'Grupo Bonn'),
      sucursal('s2', 'VW Dorada Centro', 'Grupo Bonn Dorada'),
    ]);
    const guardar = vi
      .spyOn(administradoresService, 'guardarAcceso')
      .mockResolvedValue(detalle({ permisos: ['REPORTES_VER', 'EMPLEADOS_VER'] }));
    abrir('/administradores/a1');

    fireEvent.click(await screen.findByRole('button', { name: 'Solo reportes' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Ver empleados/ }));
    expect(screen.getByRole('group', { name: 'Grupo Bonn Dorada' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /VW Dorada Centro/ }));
    expect(screen.getByText(/Cambios sin guardar/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('2 permisos · 0 sucursales')).toBeInTheDocument();
    expect(guardar).toHaveBeenCalledWith('a1', ['REPORTES_VER', 'EMPLEADOS_VER'], ['s2']);
  });

  it('busca sucursales por nombre, empresa o marca', async () => {
    vi.spyOn(administradoresService, 'obtener').mockResolvedValue(detalle());
    vi.spyOn(administradoresService, 'catalogo').mockResolvedValue(catalogo);
    vi.spyOn(sucursalesService, 'listarEnAlcance').mockResolvedValue([
      sucursal('s1', 'VW Bonn Oaxaca', 'Grupo Bonn'),
      sucursal('s2', 'VW Dorada Centro', 'Grupo Bonn Dorada'),
    ]);
    abrir('/administradores/a1');

    fireEvent.change(await screen.findByLabelText('Buscar sucursales'), { target: { value: 'dorada' } });
    expect(screen.queryByRole('checkbox', { name: /VW Bonn Oaxaca/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /VW Dorada Centro/ })).toBeInTheDocument();
  });
});
