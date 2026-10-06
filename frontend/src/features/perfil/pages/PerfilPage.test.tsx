import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useAuthStore } from '../../auth/stores/auth.store';
import { conSesion, perfil } from '../../../test/sesion';
import { perfilService } from '../services/perfil.service';
import { PerfilPage } from './PerfilPage';

function abrir() {
  render(
    <MemoryRouter>
      <PerfilPage />
    </MemoryRouter>,
  );
}

describe('PerfilPage', () => {
  beforeEach(() => {
    conSesion();
    URL.createObjectURL = vi.fn(() => 'blob:vista-previa');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('muestra los datos de la cuenta y, sin foto, las iniciales (RF-01.7, RF-01.9)', async () => {
    vi.spyOn(perfilService, 'obtener').mockResolvedValue(perfil());
    abrir();

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Sucursal Centro')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Juan Pérez' })).toHaveTextContent('JP');
  });

  it('la foto elegida es una vista previa hasta guardarla; al guardar se actualiza la sesión', async () => {
    vi.spyOn(perfilService, 'obtener').mockResolvedValue(perfil());
    const cambiar = vi.spyOn(perfilService, 'cambiarFoto').mockResolvedValue(perfil({ fotoUrl: '/api/v1/archivos/f1/contenido' }));
    const { container } = render(
      <MemoryRouter>
        <PerfilPage />
      </MemoryRouter>,
    );
    await screen.findByText('Juan Pérez');

    const foto = new File(['x'], 'yo.png', { type: 'image/png' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [foto] } });
    expect(screen.getByText(/Así se verá tu foto/)).toBeInTheDocument();
    expect(cambiar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar foto' }));
    expect(await screen.findByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    expect(cambiar).toHaveBeenCalledWith(foto);
    expect(useAuthStore.getState().usuario?.fotoUrl).toBe('/api/v1/archivos/f1/contenido');
  });

  it('rechaza en el navegador un archivo que no es imagen', async () => {
    vi.spyOn(perfilService, 'obtener').mockResolvedValue(perfil());
    const { container } = render(
      <MemoryRouter>
        <PerfilPage />
      </MemoryRouter>,
    );
    await screen.findByText('Juan Pérez');

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByText('Elige una imagen JPG, PNG o WebP.')).toBeInTheDocument();
  });

  it('el administrador ve las sucursales a su cargo', async () => {
    vi.spyOn(perfilService, 'obtener').mockResolvedValue(perfil());
    abrir();
    expect(await screen.findByText('Sucursal Centro')).toBeInTheDocument();
    expect(screen.getByText('Grupo Centro · Volkswagen')).toBeInTheDocument();
  });

  it('el superusuario ve "Toda la plataforma" y no la nota de corrección', async () => {
    vi.spyOn(perfilService, 'obtener').mockResolvedValue(perfil({ rol: 'SUPERUSUARIO', sucursales: [] }));
    abrir();
    expect(await screen.findByText('Toda la plataforma')).toBeInTheDocument();
    expect(screen.queryByText(/pide a tu administrador/)).not.toBeInTheDocument();
  });
});
