import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { authService } from '../features/auth/services/auth.service';
import { conSesion } from '../test/sesion';
import { PanelLayout } from './PanelLayout';

function abrir(ruta: string) {
  const router = createMemoryRouter(
    [
      {
        element: <PanelLayout />,
        children: [
          { path: '/panel', element: <p>Inicio admin</p> },
          { path: '/empresas', element: <p>Empresas</p> },
          { path: '/perfil', element: <p>Perfil</p> },
        ],
      },
      { path: '/login', element: <p>Pantalla de login</p> },
    ],
    { initialEntries: [ruta] },
  );
  render(<RouterProvider router={router} />);
}

const menuLateral = () => within(screen.getAllByRole('navigation', { name: 'Menú principal' })[0]);

describe('PanelLayout', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra solo el menú del superusuario y marca la página actual', () => {
    conSesion({ rol: 'SUPERUSUARIO', sucursales: [] });
    abrir('/empresas');

    const opciones = menuLateral().getAllByRole('link').map((o) => o.textContent);
    expect(opciones).toEqual(['Empresas', 'Marcas', 'Administradores', 'Mi perfil']);
    expect(menuLateral().getByRole('link', { name: 'Empresas' })).toHaveAttribute('aria-current', 'page');
  });

  it('el administrador ve las opciones de sus permisos y su sucursal junto a su nombre', () => {
    conSesion({ rol: 'ADMIN' });
    abrir('/panel');

    expect(menuLateral().getAllByRole('link').map((o) => o.textContent)).toEqual(['Inicio', 'Mi perfil']);
    expect(screen.getAllByText('Administrador')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Sucursal Centro')[0]).toBeInTheDocument();
  });

  it('con "Gestionar marcas" el administrador ve la opción Marcas', () => {
    conSesion({ rol: 'ADMIN', permisos: ['MARCAS_GESTIONAR'] });
    abrir('/panel');
    expect(menuLateral().getAllByRole('link').map((o) => o.textContent)).toEqual(['Inicio', 'Marcas', 'Mi perfil']);
  });

  it('el menú de usuario se abre, se cierra con Escape y devuelve el foco al botón', () => {
    conSesion();
    abrir('/panel');
    const boton = screen.getByRole('button', { name: /Opciones de tu cuenta/ });

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Cambiar contraseña' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton).toHaveFocus();
  });

  it('cerrar sesión lleva al inicio de sesión', async () => {
    vi.spyOn(authService, 'cerrarSesion').mockResolvedValue();
    conSesion();
    abrir('/panel');

    fireEvent.click(screen.getByRole('button', { name: /Opciones de tu cuenta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
  });

  it('ofrece saltar al contenido como primer enlace', () => {
    conSesion();
    abrir('/panel');
    expect(screen.getAllByRole('link')[0]).toHaveTextContent('Saltar al contenido');
  });
});
