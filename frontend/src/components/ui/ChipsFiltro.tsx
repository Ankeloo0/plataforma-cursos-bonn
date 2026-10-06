import styles from './ChipsFiltro.module.css';

export interface OpcionFiltro<T extends string> {
  valor: T;
  etiqueta: string;
}

// Filtro de una sola opcion con forma de pildoras (design-reference 8.4)
export function ChipsFiltro<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  opciones: OpcionFiltro<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
}) {
  return (
    <div className={styles.grupo} role="group" aria-label={etiqueta}>
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          className={styles.chip}
          aria-pressed={opcion.valor === valor}
          onClick={() => alCambiar(opcion.valor)}
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  );
}
