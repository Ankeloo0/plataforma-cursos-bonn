import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion } from '../../../test/sesion';
import { sucursalesService } from '../../empresas/services/sucursales.service';
import type { Sucursal } from '../../empresas/types/empresas.types';
import { administradoresService } from '../services/administradores.service';
import type { AdministradorDetalle, AdministradorResumen, CatalogoPermisos } from '../types/administradores.types';
import { AdministradorPage } from './AdministradorPage';
import { AdministradoresPage } from './AdministradoresPage';

const cuenta = {
  id: 'a1',
  rol: 'ADMIN',
  username: 'jperez',
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
  totalPermisos: 3,
  totalSucursales: 2,
  ...datos,
});

const detalle = (datos: Partial<AdministradorDetalle> = {}): AdministradorDetalle => ({ ...cuenta, permisos: [], sucursales: [], ...datos });

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

  it('lista los administradores con un resumen de su acceso', async () => {
    vi.spyOn(administradoresService, 'listar').mockResolvedValue({
      data: [resumen(), resumen({ id: 'a2', nombres: 'Ana', username: 'aruiz', totalPermisos: 0, totalSucursales: 0 })],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    abrir('/administradores');

    const fila = (await screen.findByRole('link', { name: 'Juan Pérez' })).closest('tr')!;
    expect(within(fila).getByText('3 permisos · 2 sucursales')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: 'Ana Pérez' }).closest('tr')!).getByText('Sin permisos')).toBeInTheDocument();
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
