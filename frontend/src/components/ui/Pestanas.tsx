import styles from './Pestanas.module.css';

export interface OpcionPestana<T extends string> {
  valor: T;
  etiqueta: string;
}

// Pestanas (design-reference 8.5). El contenido va en un elemento con role="tabpanel" e id={idPanel}.
export function Pestanas<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  idPanel,
  className,
}: {
  etiqueta: string;
  opciones: OpcionPestana<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
  idPanel: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={etiqueta} className={[styles.pestanas, className].filter(Boolean).join(' ')}>
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          role="tab"
          id={`${idPanel}-${opcion.valor}`}
          aria-selected={opcion.valor === valor}
          aria-controls={idPanel}
          className={styles.pestana}
          onClick={() => alCambiar(opcion.valor)}
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  );
}
