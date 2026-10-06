import { CircleAlert } from 'lucide-react';
import { useId, type Ref, type TextareaHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface AreaTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function AreaTexto({ etiqueta, ayuda, error, id, required, className, ref, rows = 5, ...props }: AreaTextoProps) {
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
      <textarea
        {...props}
        ref={ref}
        id={idCampo}
        rows={rows}
        required={required}
        className={`${styles.control} ${styles.area}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
      />
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
