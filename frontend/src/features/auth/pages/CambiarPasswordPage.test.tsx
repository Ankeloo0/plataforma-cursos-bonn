import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { conSesion, perfil } from '../../../test/sesion';
import { authService } from '../services/auth.service';
import { CambiarPasswordPage } from './CambiarPasswordPage';

function abrir() {
  const router = createMemoryRouter(
    [
      { path: '/cambiar-password', element: <CambiarPasswordPage /> },
      { path: '/panel', element: <p>Panel admin</p> },
    ],
    { initialEntries: ['/cambiar-password'] },
  );
  render(<RouterProvider router={router} />);
}

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

describe('CambiarPasswordPage', () => {
  beforeEach(() => conSesion({ debeCambiarPassword: true }));
  afterEach(() => vi.restoreAllMocks());

  it('con contraseña temporal se titula "Crea tu contraseña"', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña temporal')).toBeInTheDocument();
  });

  it('marca cada regla de la política mientras se escribe, con texto y no solo color', () => {
    abrir();
    escribir('Nueva contraseña', 'abc');
    const reglas = screen.getAllByRole('listitem');
    expect(reglas[0]).toHaveTextContent('Al menos 8 caracteres (pendiente)');
    expect(reglas[1]).toHaveTextContent('Al menos una letra (cumplido)');
    expect(reglas[2]).toHaveTextContent('Al menos un número (pendiente)');
  });

  it('avisa si la confirmación no coincide', async () => {
    abrir();
    escribir('Contraseña temporal', 'Temporal1');
    escribir('Nueva contraseña', 'MiClave2026');
    escribir('Confirma la nueva contraseña', 'OtraClave2026');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText(/no coinciden/)).toBeInTheDocument();
  });

  it('al guardar lleva al panel de su rol', async () => {
    vi.spyOn(authService, 'cambiarPassword').mockResolvedValue(perfil());
    abrir();
    escribir('Contraseña temporal', 'Temporal1');
    escribir('Nueva contraseña', 'MiClave2026');
    escribir('Confirma la nueva contraseña', 'MiClave2026');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Panel admin')).toBeInTheDocument();
  });

  it('si la contraseña temporal es incorrecta, lo dice junto a ese campo', async () => {
    vi.spyOn(authService, 'cambiarPassword').mockRejectedValue({
      statusCode: 422,
      message: 'La contraseña actual no es correcta.',
      code: 'PASSWORD_ACTUAL_INCORRECTA',
    });
    abrir();
    escribir('Contraseña temporal', 'NoEsLaMia1');
    escribir('Nueva contraseña', 'MiClave2026');
    escribir('Confirma la nueva contraseña', 'MiClave2026');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña temporal')).toHaveAttribute('aria-invalid', 'true');
  });
});
