import { Ellipsis, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import styles from './MenuAcciones.module.css';

export interface Accion {
  etiqueta: string;
  icono: LucideIcon;
  alElegir: () => void;
  peligro?: boolean;
}

// Menu "..." de una fila con las acciones secundarias (design-reference 8.4)
export function MenuAcciones({ etiqueta, acciones }: { etiqueta: string; acciones: Accion[] }) {
  const [abierto, setAbierto] = useState(false);
  // Posicion fija calculada al abrir: asi la lista no se recorta dentro de una tabla con desplazamiento
  const [posicion, setPosicion] = useState<CSSProperties>({});
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idLista = useId();

  useEffect(() => {
    if (!abierto) return;
    function alPresionar(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    }
    const cerrar = () => setAbierto(false);
    document.addEventListener('mousedown', alPresionar);
    document.addEventListener('keydown', alTeclear);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', alPresionar);
      document.removeEventListener('keydown', alTeclear);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [abierto]);

  return (
    <div className={styles.menu} ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={styles.boton}
        aria-label={etiqueta}
        aria-expanded={abierto}
        aria-controls={idLista}
        onClick={() => {
          const caja = boton.current?.getBoundingClientRect();
          if (caja) {
            // Si no cabe abajo, se abre hacia arriba
            const haciaArriba = window.innerHeight - caja.bottom < 56 * acciones.length + 24;
            setPosicion({
              right: window.innerWidth - caja.right,
              ...(haciaArriba ? { bottom: window.innerHeight - caja.top + 4 } : { top: caja.bottom + 4 }),
            });
          }
          setAbierto((a) => !a);
        }}
      >
        <Ellipsis size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {abierto && (
        <ul id={idLista} className={styles.lista} style={posicion}>
          {acciones.map(({ etiqueta: texto, icono: Icono, alElegir, peligro }) => (
            <li key={texto}>
              <button
                type="button"
                className={`${styles.opcion} ${peligro ? styles.peligro : ''}`}
                onClick={() => {
                  setAbierto(false);
                  alElegir();
                }}
              >
                <Icono size={18} strokeWidth={1.75} aria-hidden="true" />
                {texto}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
