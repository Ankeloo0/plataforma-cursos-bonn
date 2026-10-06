import { Check, Circle } from 'lucide-react';
import { REGLAS_PASSWORD } from '../utils/politica-password';
import styles from './ListaPolitica.module.css';

// La politica visible mientras se escribe (RN-01.5); cada regla con icono y texto, nunca solo color
export function ListaPolitica({ password, id }: { password: string; id?: string }) {
  return (
    <ul className={styles.lista} id={id} aria-label="Tu contraseña debe tener">
      {REGLAS_PASSWORD.map((regla) => {
        const cumple = regla.cumple(password);
        const Icono = cumple ? Check : Circle;
        return (
          <li key={regla.texto} className={cumple ? styles.cumple : undefined}>
            <Icono size={16} strokeWidth={cumple ? 2.25 : 1.75} aria-hidden="true" />
            <span>{regla.texto}</span>
            <span className="solo-lector">{cumple ? ' (cumplido)' : ' (pendiente)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
