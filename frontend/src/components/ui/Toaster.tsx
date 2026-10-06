import { CircleAlert, CircleCheck } from 'lucide-react';
import styles from './Toaster.module.css';
import { useToastStore } from './toast.store';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className={styles.contenedor} role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icono = toast.tono === 'exito' ? CircleCheck : CircleAlert;
        return (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.tono]}`}>
            <Icono size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{toast.texto}</span>
          </div>
        );
      })}
    </div>
  );
}
