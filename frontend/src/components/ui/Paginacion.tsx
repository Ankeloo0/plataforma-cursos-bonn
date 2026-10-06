import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import styles from './Paginacion.module.css';

export interface MetaPaginacion {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginacionProps {
  meta: MetaPaginacion;
  // En plural: "empresas", "empleados"
  nombre: string;
  alCambiarPagina: (pagina: number) => void;
  alCambiarLimite: (limite: number) => void;
}

const LIMITES = [10, 20, 50];

// Paginas visibles: primera, ultima y las vecinas de la actual, con huecos marcados con null
function paginasVisibles(actual: number, total: number): (number | null)[] {
  const paginas = new Set([1, total, actual - 1, actual, actual + 1].filter((p) => p >= 1 && p <= total));
  const ordenadas = [...paginas].sort((a, b) => a - b);
  return ordenadas.flatMap((p, i) => (i > 0 && p - ordenadas[i - 1] > 1 ? [null, p] : [p]));
}

export function Paginacion({ meta, nombre, alCambiarPagina, alCambiarLimite }: PaginacionProps) {
  const idLimite = useId();
  if (meta.total === 0) return null;

  return (
    <nav className={styles.paginacion} aria-label={`Páginas de ${nombre}`}>
      <div className={styles.resumen}>
        <label htmlFor={idLimite}>Mostrando</label>
        <select
          id={idLimite}
          className={styles.limite}
          value={meta.limit}
          onChange={(e) => alCambiarLimite(Number(e.target.value))}
        >
          {LIMITES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <span className="cifras-tabulares">
          de {meta.total.toLocaleString('es-MX')} {nombre}
        </span>
      </div>

      {meta.totalPages > 1 && (
        <ul className={styles.paginas}>
          <li>
            <button
              type="button"
              className={styles.pagina}
              aria-label="Página anterior"
              disabled={meta.page <= 1}
              onClick={() => alCambiarPagina(meta.page - 1)}
            >
              <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
          {paginasVisibles(meta.page, meta.totalPages).map((p, i) =>
            p === null ? (
              <li key={`hueco-${i}`} className={styles.hueco} aria-hidden="true">
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  className={`${styles.pagina} ${p === meta.page ? styles.actual : ''}`}
                  aria-current={p === meta.page ? 'page' : undefined}
                  aria-label={`Página ${p}`}
                  onClick={() => alCambiarPagina(p)}
                >
                  {p}
                </button>
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              className={styles.pagina}
              aria-label="Página siguiente"
              disabled={meta.page >= meta.totalPages}
              onClick={() => alCambiarPagina(meta.page + 1)}
            >
              <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
}
