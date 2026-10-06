import type { ReactNode } from 'react';
import styles from './Tabla.module.css';

// Tabla del panel (design-reference 8.4). En celular cada fila se vuelve una tarjeta:
// cada celda muestra su encabezado con data-etiqueta.
export function Tabla({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={styles.contenedor}>
      <table className={styles.tabla}>
        <caption className="solo-lector">{titulo}</caption>
        {children}
      </table>
    </div>
  );
}
