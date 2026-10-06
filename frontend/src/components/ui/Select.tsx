import { CircleAlert } from 'lucide-react';
import { useId, type Ref, type SelectHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  opciones: { valor: string; etiqueta: string }[];
  // Primera opcion vacia ("Elige una marca")
  textoVacio?: string;
  ref?: Ref<HTMLSelectElement>;
}

// Misma forma que Input (design-reference 8.2)
export function Select({ etiqueta, ayuda, error, opciones, textoVacio, id, required, className, ref, ...props }: SelectProps) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idAyuda = `${idCampo}-ayuda`;
  const idError = `${idCampo}-error`;

  return (
    <div className={[styles.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={idCampo} className={styles.etiqueta}>
        {etiqueta}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <select
        {...props}
        ref={ref}
        id={idCampo}
        required={required}
        className={`${styles.control} ${styles.lista}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
      >
        {textoVacio !== undefined && <option value="">{textoVacio}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      {ayuda && !error && (
        <p id={idAyuda} className={styles.ayuda}>
          {ayuda}
        </p>
      )}
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
