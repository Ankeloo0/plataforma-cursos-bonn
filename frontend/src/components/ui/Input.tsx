import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // Siempre visible. El placeholder nunca sustituye a la etiqueta; solo da un ejemplo ("p. ej. jperez").
  etiqueta: string;
  // Texto de ayuda debajo del campo ("Unico dentro de la empresa.").
  ayuda?: string;
  // Que paso y como arreglarlo. Reemplaza a la ayuda mientras exista.
  error?: string;
  // Control dentro del campo, a la derecha (p. ej. el boton para mostrar la contrasena)
  final?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

// Campo de formulario (design-reference.md 8.2): fondo gris claro y linea inferior,
// la forma del sitio de referencia reforzada para uso administrativo.
//
// `required` agrega el asterisco. Funciona con react-hook-form: `<Input {...register('username')} />`.
export function Input({
  etiqueta,
  ayuda,
  error,
  final,
  id,
  required,
  className,
  ref,
  'aria-describedby': descritoPorExterno,
  ...props
}: InputProps) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idAyuda = `${idCampo}-ayuda`;
  const idError = `${idCampo}-error`;
  const descritoPor = [error ? idError : ayuda ? idAyuda : undefined, descritoPorExterno].filter(Boolean).join(' ') || undefined;

  return (
    <div className={[styles.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={idCampo} className={styles.etiqueta}>
        {etiqueta}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      <div className={styles.envoltura}>
        <input
          {...props}
          ref={ref}
          id={idCampo}
          required={required}
          className={[styles.control, final && styles.conFinal].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={descritoPor}
        />
        {final && <div className={styles.final}>{final}</div>}
      </div>

      {ayuda && !error && (
        <p id={idAyuda} className={styles.ayuda}>
          {ayuda}
        </p>
      )}
      {/* Región viva: el lector de pantalla anuncia el error en cuanto aparece (§12.1) */}
      <div aria-live="polite">
        {error && (
          <p id={idError} className={styles.error}>
            <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}
