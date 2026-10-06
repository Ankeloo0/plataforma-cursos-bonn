import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';
import { indiceDeColor, iniciales } from './avatar.utils';

describe('Avatar', () => {
  it('muestra la foto con el nombre como texto alternativo', () => {
    render(<Avatar id="u1" nombres="Ana" apellidoPaterno="López" src="/foto.webp" />);
    expect(screen.getByRole('img', { name: 'Ana López' })).toHaveAttribute('src', '/foto.webp');
  });

  it('sin foto muestra las iniciales, con el nombre para el lector de pantalla', () => {
    render(<Avatar id="u1" nombres="ángel daniel" apellidoPaterno="sánchez" />);
    const avatar = screen.getByRole('img', { name: 'ángel daniel sánchez' });
    expect(avatar).toHaveTextContent('ÁS');
  });

  it('si la foto no carga, cambia a las iniciales', () => {
    render(<Avatar id="u1" nombres="Ana" apellidoPaterno="López" src="/rota.jpg" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img', { name: 'Ana López' })).toHaveTextContent('AL');
  });

  it('decorativo: el lector de pantalla no repite el nombre', () => {
    const { container } = render(<Avatar id="u1" nombres="Ana" decorativo />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('la misma persona siempre recibe el mismo color', () => {
    const id = '5f0c2d1e-8a7b-4c3d-9e2f-1a2b3c4d5e6f';
    expect(indiceDeColor(id)).toBe(indiceDeColor(id));
    expect(indiceDeColor(id)).toBeGreaterThanOrEqual(0);
    expect(indiceDeColor(id)).toBeLessThan(5);
  });

  it('forma las iniciales con el primer nombre y el apellido paterno', () => {
    expect(iniciales('Juan Carlos', 'Pérez')).toBe('JP');
    expect(iniciales('Ana')).toBe('A');
  });
});
