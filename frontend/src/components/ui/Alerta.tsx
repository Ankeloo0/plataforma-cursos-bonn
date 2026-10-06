import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Alerta.module.css';

export type TonoAlerta = 'critico' | 'exito' | 'info';

const ICONOS: Record<TonoAlerta, LucideIcon> = { critico: CircleAlert, exito: CircleCheck, info: Info };

export interface AlertaProps {
  tono?: TonoAlerta;
  children: ReactNode;
}

// Mensaje de la pagina o del formulario completo. Los errores de un campo van junto al campo.
export function Alerta({ tono = 'critico', children }: AlertaProps) {
  const Icono = ICONOS[tono];
  return (
    <div className={`${styles.alerta} ${styles[tono]}`} role={tono === 'critico' ? 'alert' : 'status'}>
      <Icono size={20} strokeWidth={1.75} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
