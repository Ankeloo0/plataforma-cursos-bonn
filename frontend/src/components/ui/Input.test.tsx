import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('asocia la etiqueta con el campo', () => {
    render(<Input etiqueta="Usuario" placeholder="p. ej. jperez" />);
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('placeholder', 'p. ej. jperez');
  });

  it('marca el campo obligatorio con asterisco visible y required', () => {
    render(<Input etiqueta="Número de empleado" required />);
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('textbox', { name: /Número de empleado/ })).toBeRequired();
  });

  it('vincula la ayuda al campo', () => {
    render(<Input etiqueta="Número de empleado" ayuda="Único dentro de la empresa." />);
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('Único dentro de la empresa.');
  });

  it('con error: marca el campo inválido, reemplaza la ayuda y lo anuncia', () => {
    render(<Input etiqueta="Número de empleado" ayuda="Único dentro de la empresa." error="Ese número ya existe." />);

    const campo = screen.getByRole('textbox');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Ese número ya existe.');
    expect(screen.queryByText('Único dentro de la empresa.')).not.toBeInTheDocument();
    expect(screen.getByText('Ese número ya existe.').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });
});
