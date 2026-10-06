import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './PanelLateral.module.css';

export interface PanelLateralProps {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  alCerrar: () => void;
  children: ReactNode;
}

// Crear o editar sin salir de la pantalla (design-reference 8.5). Con showModal el navegador
// atrapa el foco, cierra con Escape y lo devuelve al elemento que lo abrio.
export function PanelLateral({ abierto, titulo, descripcion, alCerrar, children }: PanelLateralProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={dialogo}
      className={styles.panel}
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) alCerrar();
      }}
    >
      {abierto && (
        <div className={styles.contenido}>
          <header className={styles.encabezado}>
            <div>
              <h2 id={idTitulo} className={styles.titulo}>
                {titulo}
              </h2>
              {descripcion && <p className={styles.descripcion}>{descripcion}</p>}
            </div>
            <button type="button" className={styles.cerrar} aria-label="Cerrar" onClick={alCerrar}>
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
