import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { InicioEmpleadoPage } from '../features/inicio/pages/InicioEmpleadoPage';
import { LayoutSegunRol } from '../router/LayoutSegunRol';
import { conSesion } from '../test/sesion';
import { EmpleadoLayout } from './EmpleadoLayout';

const empleado = {
  rol: 'EMPLEADO' as const,
  nombres: 'Ana',
  username: null,
  sucursales: [],
  sucursal: { id: 's1', nombre: 'VW Bonn Oaxaca', empresa: { id: 'g1', nombre: 'Grupo Bonn' }, marca: { id: 'm1', nombre: 'Volkswagen' } },
  empleado: { numeroEmpleado: '1024', fechaIngreso: '2026-03-01', puesto: { id: 'p1', nombre: 'Asesor de servicio' }, area: { id: 'a1', nombre: 'Servicio' } },
};

function abrir(ruta: string) {
  const router = createMemoryRouter(
    [
      { element: <EmpleadoLayout />, children: [{ path: '/', element: <InicioEmpleadoPage /> }] },
      { element: <LayoutSegunRol />, children: [{ path: '/perfil', element: <p>Mi perfil</p> }] },
    ],
    { initialEntries: [ruta] },
  );
  render(<RouterProvider router={router} />);
}

describe('Panel del empleado (HU-13)', () => {
  it('saluda al empleado con su puesto y su sucursal, con navegación superior y sin barra lateral', () => {
    conSesion(empleado);
    abrir('/');

    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByText('Asesor de servicio · VW Bonn Oaxaca · Grupo Bonn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('"Mi perfil" del empleado usa su navegación superior', () => {
    conSesion(empleado);
    abrir('/perfil');
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
