import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './EstadoVacio.module.css';

export interface EstadoVacioProps {
  icono: LucideIcon;
  titulo: string;
  children: ReactNode;
  // La accion que resuelve el vacio ("Crear puesto"); se omite si todavia no existe
  accion?: ReactNode;
}

// Un estado vacio ensena que hacer (design-reference 8.5)
export function EstadoVacio({ icono: Icono, titulo, children, accion }: EstadoVacioProps) {
  return (
    <section className={styles.vacio}>
      <span className={styles.icono}>
        <Icono size={24} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className={styles.titulo}>{titulo}</h2>
      <div className={styles.texto}>{children}</div>
      {accion && <div className={styles.accion}>{accion}</div>}
    </section>
  );
}
