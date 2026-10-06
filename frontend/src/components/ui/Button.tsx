import { LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import styles from './Button.module.css';

export type VarianteBoton = 'primario' | 'secundario' | 'texto' | 'peligro';
export type TamanoBoton = 'compacto' | 'normal' | 'grande';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Primario: la accion principal, una por vista. Peligro: solo dentro del dialogo de confirmacion.
  variante?: VarianteBoton;
  // Compacto (32 px) en tablas - normal (40 px) - grande (48 px) en el inicio de sesion.
  tamano?: TamanoBoton;
  icono?: LucideIcon;
  // Muestra el indicador y `textoCargando`; el boton no se puede volver a presionar.
  cargando?: boolean;
  // Texto mientras carga, con la accion en curso: "Guardando...".
  textoCargando?: string;
  // Si el boton esta deshabilitado y la razon no es obvia, se explica al pasar el cursor o con el foco.
  motivoDeshabilitado?: string;
}

// Boton pildora de la plataforma (design-reference.md 8.1).
//
// Deshabilitado y cargando usan `aria-disabled` en lugar de `disabled`: el boton sigue recibiendo
// el foco, asi el lector de pantalla y el teclado pueden llegar a el y conocer el motivo.
export function Button({
  variante = 'primario',
  tamano = 'normal',
  icono: Icono,
  cargando = false,
  textoCargando,
  motivoDeshabilitado,
  disabled = false,
  type = 'button',
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const inactivo = disabled || cargando;

  function alHacerClic(evento: MouseEvent<HTMLButtonElement>) {
    if (inactivo) {
      evento.preventDefault();  // tambien evita que un boton submit envie el formulario
      return;
    }
    onClick?.(evento);
  }

  const clases = [styles.boton, styles[variante], styles[tamano], className].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      type={type}
      className={clases}
      aria-disabled={inactivo || undefined}
      aria-busy={cargando || undefined}
      data-estado={cargando ? 'cargando' : disabled ? 'deshabilitado' : undefined}
      title={disabled && !cargando ? motivoDeshabilitado : undefined}
      onClick={alHacerClic}
    >
      {cargando ? (
        <LoaderCircle className={styles.indicador} size={18} strokeWidth={2} aria-hidden="true" />
      ) : (
        Icono && <Icono size={20} strokeWidth={1.75} aria-hidden="true" />
      )}
      <span>{cargando && textoCargando ? textoCargando : children}</span>
    </button>
  );
}
