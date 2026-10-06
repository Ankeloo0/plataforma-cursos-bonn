import { Search, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import styles from './CampoBusqueda.module.css';

// Avisa la busqueda 300 ms despues de la ultima tecla, para no consultar la API con cada letra
export function CampoBusqueda({
  etiqueta,
  placeholder,
  valor,
  alBuscar,
}: {
  etiqueta: string;
  placeholder?: string;
  valor: string;
  alBuscar: (texto: string) => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState(valor);
  const [valorPrevio, setValorPrevio] = useState(valor);

  // Si el valor cambia desde afuera (p. ej. "Limpiar filtros"), el campo lo refleja
  if (valor !== valorPrevio) {
    setValorPrevio(valor);
    setTexto(valor);
  }

  useEffect(() => {
    if (texto === valor) return;
    const espera = setTimeout(() => alBuscar(texto.trim()), 300);
    return () => clearTimeout(espera);
  }, [texto, valor, alBuscar]);

  return (
    <div className={styles.campo}>
      <label htmlFor={id} className="solo-lector">
        {etiqueta}
      </label>
      <Search size={20} strokeWidth={1.75} aria-hidden="true" className={styles.icono} />
      <input
        id={id}
        type="search"
        className={styles.control}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {texto && (
        <button type="button" className={styles.limpiar} aria-label="Borrar búsqueda" onClick={() => setTexto('')}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
