import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion } from '../../../test/sesion';
import { marcasService } from '../../marcas/services/marcas.service';
import type { Marca } from '../../marcas/types/marcas.types';
import { empresasService } from '../services/empresas.service';
import { sucursalesService } from '../services/sucursales.service';
import type { Empresa, Sucursal } from '../types/empresas.types';
import { EmpresaDetallePage } from './EmpresaDetallePage';
import { EmpresasPage } from './EmpresasPage';

const auditoria = { creadoEn: '2026-10-02T20:00:00Z', creadoPor: 'Superusuario', actualizadoEn: '2026-10-02T20:00:00Z', actualizadoPor: null };

const empresa = (datos: Partial<Empresa> = {}): Empresa => ({
  id: 'e1',
  nombre: 'Grupo Bonn',
  razonSocial: 'Automotriz Bonn S.A. de C.V.',
  prefijoFolio: 'GB',
  activo: true,
  sucursalesActivas: 2,
  administradores: 1,
  empleadosActivos: 0,
  ...auditoria,
  ...datos,
});

const marca = (datos: Partial<Marca> = {}): Marca => ({
  id: 'm1',
  nombre: 'Volkswagen',
  logoUrl: null,
  instruccionesAsistente: null,
  activo: true,
  sucursales: 2,
  empresas: 1,
  ...auditoria,
  ...datos,
});

const sucursal = (datos: Partial<Sucursal> = {}): Sucursal => ({
  id: 's1',
  nombre: 'Volkswagen Bonn Oaxaca',
  direccion: 'Av. Universidad 801',
  activo: true,
  empresa: { id: 'e1', nombre: 'Grupo Bonn', activo: true },
  marca: { id: 'm1', nombre: 'Volkswagen' },
  administradores: [{ id: 'a1', nombre: 'Juan Pérez' }],
  empleadosActivos: 12,
  ...auditoria,
  ...datos,
});

const paginado = (data: Empresa[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } });

function abrir(ruta: string) {
  const router = createMemoryRouter(
    [
      { path: '/empresas', element: <EmpresasPage /> },
      { path: '/empresas/:id', element: <EmpresaDetallePage /> },
    ],
    { initialEntries: [ruta] },
  );
  render(<RouterProvider router={router} />);
}

describe('Empresas y sucursales', () => {
  beforeEach(() => {
    conSesion({ rol: 'SUPERUSUARIO', sucursales: [] });
    vi.spyOn(marcasService, 'listar').mockResolvedValue([marca(), marca({ id: 'm2', nombre: 'Seat', activo: false })]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lista las empresas con su prefijo, su estado y sus indicadores', async () => {
    vi.spyOn(empresasService, 'listar').mockResolvedValue(
      paginado([empresa(), empresa({ id: 'e2', nombre: 'Grupo Bonn Dorada', prefijoFolio: 'GBD', activo: false, razonSocial: null })]),
    );
    abrir('/empresas');

    const fila = (await screen.findByRole('link', { name: 'Grupo Bonn' })).closest('tr')!;
    expect(within(fila).getByText('GB')).toBeInTheDocument();
    expect(within(fila).getByText('Activa')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: 'Grupo Bonn Dorada' }).closest('tr')!).getByText('Inactiva')).toBeInTheDocument();
    expect(screen.getByText('de 2 empresas')).toBeInTheDocument();
  });

  it('al crear una empresa con su prefijo abre su detalle con "Nueva sucursal" ya abierto (HU-00)', async () => {
    vi.spyOn(empresasService, 'listar').mockResolvedValue(paginado([]));
    const crear = vi.spyOn(empresasService, 'crear').mockResolvedValue(empresa({ id: 'nueva', nombre: 'Kia Sur', prefijoFolio: 'KS' }));
    vi.spyOn(empresasService, 'obtener').mockResolvedValue(empresa({ id: 'nueva', nombre: 'Kia Sur', prefijoFolio: 'KS' }));
    vi.spyOn(sucursalesService, 'listarDeEmpresa').mockResolvedValue([]);
    abrir('/empresas');

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva empresa' }));
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Kia Sur' } });
    fireEvent.change(screen.getByLabelText(/Prefijo del folio/), { target: { value: 'ks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear empresa' }));

    expect(await screen.findByRole('heading', { name: 'Kia Sur' })).toBeInTheDocument();
    expect(crear).toHaveBeenCalledWith({ nombre: 'Kia Sur', razonSocial: null, prefijoFolio: 'KS' });
    expect(screen.getByRole('heading', { name: 'Nueva sucursal' })).toBeInTheDocument();
  });

  it('muestra junto al campo que el prefijo ya lo usa otra empresa', async () => {
    vi.spyOn(empresasService, 'listar').mockResolvedValue(paginado([]));
    vi.spyOn(empresasService, 'crear').mockRejectedValue({
      statusCode: 409,
      message: 'Otra empresa ya usa ese prefijo de folio. Elige otro.',
      code: 'EMPRESA_PREFIJO_DUPLICADO',
    });
    abrir('/empresas');

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva empresa' }));
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Otra' } });
    fireEvent.change(screen.getByLabelText(/Prefijo del folio/), { target: { value: 'GB' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear empresa' }));

    expect(await screen.findByText('Otra empresa ya usa ese prefijo de folio. Elige otro.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Prefijo del folio/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('en el detalle lista las sucursales con su marca y marca las que no tienen administrador (RF-00.9)', async () => {
    vi.spyOn(empresasService, 'obtener').mockResolvedValue(empresa());
    vi.spyOn(sucursalesService, 'listarDeEmpresa').mockResolvedValue([
      sucursal(),
      sucursal({ id: 's2', nombre: 'Volkswagen Plaza Bonn', administradores: [] }),
    ]);
    abrir('/empresas/e1');

    const fila = (await screen.findByText('Volkswagen Bonn Oaxaca')).closest('tr')!;
    expect(within(fila).getByText('Juan Pérez')).toBeInTheDocument();
    expect(within(screen.getByText('Volkswagen Plaza Bonn').closest('tr')!).getByText('Sin administrador')).toBeInTheDocument();
  });

  it('la nueva sucursal solo ofrece marcas activas y avisa al cambiar la marca de una existente', async () => {
    vi.spyOn(empresasService, 'obtener').mockResolvedValue(empresa());
    vi.spyOn(sucursalesService, 'listarDeEmpresa').mockResolvedValue([sucursal()]);
    abrir('/empresas/e1');

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva sucursal' }));
    const opciones = within(screen.getByLabelText(/^Marca/)).getAllByRole('option').map((o) => o.textContent);
    expect(opciones).toEqual(['Elige una marca', 'Volkswagen']);
  });
});
