import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Chip.module.css';

// Tonos de estado (design-reference.md 4.2 y 4.3):
// neutro = sin iniciar - info = en proceso - exito = completado - aviso = por vencer -
// critico = vencido o reprobado - marca = atributo "Obligatorio" (contorno).
export type TonoChip = 'neutro' | 'info' | 'exito' | 'aviso' | 'critico' | 'marca';

export interface ChipProps {
  tono?: TonoChip;
  // El estado nunca se comunica solo con color: siempre icono y texto.
  icono: LucideIcon;
  children: ReactNode;
}

// Pildora de estado de 24 px: icono de 16 px + texto (design-reference.md 8.5).
export function Chip({ tono = 'neutro', icono: Icono, children }: ChipProps) {
  return (
    <span className={`${styles.chip} ${styles[tono]}`}>
      <Icono size={16} strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
