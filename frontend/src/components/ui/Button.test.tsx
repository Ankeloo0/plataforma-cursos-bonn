import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('ejecuta la acción al hacer clic', () => {
    const alHacerClic = vi.fn();
    render(<Button onClick={alHacerClic}>Guardar</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(alHacerClic).toHaveBeenCalledOnce();
  });

  it('mientras carga muestra la acción en curso y no se puede volver a presionar', () => {
    const alHacerClic = vi.fn();
    render(
      <Button cargando textoCargando="Guardando…" onClick={alHacerClic}>
        Guardar
      </Button>,
    );

    const boton = screen.getByRole('button', { name: 'Guardando…' });
    fireEvent.click(boton);
    expect(alHacerClic).not.toHaveBeenCalled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
    expect(boton).toHaveAttribute('aria-disabled', 'true');
  });

  it('deshabilitado sigue siendo alcanzable con el teclado y explica el motivo', () => {
    const alHacerClic = vi.fn();
    render(
      <Button disabled motivoDeshabilitado="Completa todos los temas" onClick={alHacerClic}>
        Presentar evaluación
      </Button>,
    );

    const boton = screen.getByRole('button', { name: 'Presentar evaluación' });
    fireEvent.click(boton);
    expect(alHacerClic).not.toHaveBeenCalled();
    expect(boton).not.toBeDisabled();  // usa aria-disabled para conservar el foco
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(boton).toHaveAccessibleDescription('Completa todos los temas');
  });

  it('un botón submit deshabilitado no envía el formulario', () => {
    const alEnviar = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={alEnviar}>
        <Button type="submit" cargando>
          Entrar
        </Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(alEnviar).not.toHaveBeenCalled();
  });

  it('es de tipo "button" por defecto, para no enviar formularios por accidente', () => {
    render(<Button>Cancelar</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
