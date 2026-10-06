import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { useAuthStore } from '../features/auth/stores/auth.store';
import { conSesion, sinSesion } from '../test/sesion';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { RoleRoute } from './RoleRoute';

function abrir(ruta: string) {
  const router = createMemoryRouter(
    [
      { element: <PublicOnlyRoute />, children: [{ path: '/login', element: <p>Pantalla de login</p> }] },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/cambiar-password', element: <p>Crear contraseña</p> },
          { element: <RoleRoute roles={['SUPERUSUARIO']} />, children: [{ path: '/empresas', element: <p>Panel super</p> }] },
          { element: <RoleRoute roles={['ADMIN']} />, children: [{ path: '/panel', element: <p>Panel admin</p> }] },
          {
            element: <RoleRoute roles={['SUPERUSUARIO', 'ADMIN']} permisos={['MARCAS_GESTIONAR']} />,
            children: [{ path: '/marcas', element: <p>Marcas</p> }],
          },
        ],
      },
    ],
    { initialEntries: [ruta] },
  );
  render(<RouterProvider router={router} />);
}

describe('Rutas protegidas', () => {
  it('sin sesión manda al inicio de sesión', () => {
    sinSesion();
    abrir('/panel');
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
  });

  it('mientras verifica la sesión no muestra ni el formulario ni el panel', () => {
    useAuthStore.setState({ usuario: null, estado: 'verificando' });
    abrir('/login');
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cargando')).toHaveAttribute('aria-busy', 'true');
  });

  it('con contraseña temporal solo deja ver "Crea tu contraseña" (RF-01.2)', () => {
    conSesion({ debeCambiarPassword: true });
    abrir('/panel');
    expect(screen.getByText('Crear contraseña')).toBeInTheDocument();
  });

  it('un rol que escribe la URL de otro rol vuelve a su propio inicio (RN-00.1)', () => {
    conSesion({ rol: 'ADMIN' });
    abrir('/empresas');
    expect(screen.getByText('Panel admin')).toBeInTheDocument();
  });

  it('quien ya tiene sesión no ve el inicio de sesión', () => {
    conSesion({ rol: 'SUPERUSUARIO', sucursales: [] });
    abrir('/login');
    expect(screen.getByText('Panel super')).toBeInTheDocument();
  });

  it('una ruta con permiso: el administrador sin él vuelve a su inicio; con él, o siendo superusuario, entra', () => {
    conSesion({ rol: 'ADMIN', permisos: ['REPORTES_VER'] });
    abrir('/marcas');
    expect(screen.getByText('Panel admin')).toBeInTheDocument();
  });

  it('el administrador con el permiso entra a la ruta', () => {
    conSesion({ rol: 'ADMIN', permisos: ['MARCAS_GESTIONAR'] });
    abrir('/marcas');
    expect(screen.getByText('Marcas')).toBeInTheDocument();
  });
});
