import { render, screen } from '@testing-library/react';
import { CircleCheck } from 'lucide-react';
import { Chip } from './Chip';

describe('Chip', () => {
  it('comunica el estado con texto, no solo con color', () => {
    const { container } = render(
      <Chip tono="exito" icono={CircleCheck}>
        Completado
      </Chip>,
    );
    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
