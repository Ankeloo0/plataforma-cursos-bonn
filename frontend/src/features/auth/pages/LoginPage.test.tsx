import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { perfil, sinSesion } from '../../../test/sesion';
import { authService } from '../services/auth.service';
import { LoginPage } from './LoginPage';

const EMPRESAS = [
  { id: 'e1', nombre: 'Grupo Bonn' },
  { id: 'e2', nombre: 'Grupo Bonn Dorada' },
];

function abrir() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/panel', element: <p>Panel admin</p> },
      { path: '/', element: <p>Inicio empleado</p> },
      { path: '/cambiar-password', element: <p>Crear contraseña</p> },
    ],
    { initialEntries: ['/login'] },
  );
  render(<RouterProvider router={router} />);
}

describe('LoginPage', () => {
  beforeEach(() => {
    sinSesion();
    localStorage.clear();
    vi.spyOn(authService, 'listarEmpresas').mockResolvedValue(EMPRESAS);
  });
  afterEach(() => vi.restoreAllMocks());

  async function llenar(empresa: string, numero: string, password: string) {
    fireEvent.change(await screen.findByLabelText('Empresa'), { target: { value: empresa } });
    fireEvent.change(screen.getByLabelText('Número de empleado'), { target: { value: numero } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
  }

  it('es un solo acceso, sin pestañas por tipo de usuario', async () => {
    abrir();
    await screen.findByLabelText('Empresa');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Usuario')).not.toBeInTheDocument();
  });

  it('el empleado entra con empresa, número y contraseña y llega a su inicio', async () => {
    const llamada = vi.spyOn(authService, 'iniciarSesion').mockResolvedValue(perfil({ rol: 'EMPLEADO' }));
    abrir();

    await llenar('e2', '1024', 'Clave2026');

    expect(await screen.findByText('Inicio empleado')).toBeInTheDocument();
    expect(llamada).toHaveBeenCalledWith('e2', '1024', 'Clave2026');
  });

  it('el administrador entra por el mismo formulario y llega al panel de su rol', async () => {
    const llamada = vi.spyOn(authService, 'iniciarSesion').mockResolvedValue(perfil({ rol: 'ADMIN' }));
    abrir();

    await llenar('e1', 'A-100', 'Clave2026');

    expect(await screen.findByText('Panel admin')).toBeInTheDocument();
    expect(llamada).toHaveBeenCalledWith('e1', 'A-100', 'Clave2026');
  });

  it('con contraseña temporal lleva a "Crea tu contraseña"', async () => {
    vi.spyOn(authService, 'iniciarSesion').mockResolvedValue(perfil({ debeCambiarPassword: true }));
    abrir();
    await llenar('e1', '1', 'Temporal1');
    expect(await screen.findByText('Crear contraseña')).toBeInTheDocument();
  });

  it('recuerda la empresa en el dispositivo para la próxima vez', async () => {
    vi.spyOn(authService, 'iniciarSesion').mockResolvedValue(perfil({ rol: 'EMPLEADO' }));
    abrir();
    await llenar('e2', '1024', 'Clave2026');
    await screen.findByText('Inicio empleado');

    cleanup();
    abrir();
    expect(await screen.findByLabelText('Empresa')).toHaveValue('e2');
  });

  it('pide la empresa, el número y la contraseña sin llamar a la API', async () => {
    const llamada = vi.spyOn(authService, 'iniciarSesion');
    abrir();
    await screen.findByLabelText('Empresa');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Elige tu empresa.')).toBeInTheDocument();
    expect(screen.getByText('Escribe tu número de empleado.')).toBeInTheDocument();
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument();
    expect(llamada).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de la API cuando los datos fallan', async () => {
    vi.spyOn(authService, 'iniciarSesion').mockRejectedValue({
      statusCode: 401,
      message: 'Empresa, número de empleado o contraseña incorrectos.',
      code: 'CREDENCIALES_INVALIDAS',
    });
    abrir();
    await llenar('e1', '1024', 'Mala1234');
    expect(await screen.findByRole('alert')).toHaveTextContent('Empresa, número de empleado o contraseña incorrectos.');
  });

  it('si no carga la lista de empresas, deja reintentar', async () => {
    vi.spyOn(authService, 'listarEmpresas').mockRejectedValueOnce({ statusCode: 0, message: 'Sin conexión' }).mockResolvedValue(EMPRESAS);
    abrir();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la lista de empresas');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Empresa')).toBeInTheDocument();
  });

  it('el botón de mostrar contraseña cambia el tipo del campo', async () => {
    abrir();
    const campo = await screen.findByLabelText('Contraseña');
    expect(campo).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    await waitFor(() => expect(campo).toHaveAttribute('type', 'text'));
  });
});
