import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Alerta } from './Alerta';
import { Button } from './Button';
import styles from './Dialogo.module.css';

export interface DialogoProps {
  abierto: boolean;
  titulo: string;
  children: ReactNode;
  // El boton dice la accion exacta ("Desactivar empresa"), nunca "Aceptar"
  textoConfirmar: string;
  // Cuando "Cancelar" se confundiria con la accion ("Cancelar subida"): "Seguir subiendo"
  textoCancelar?: string;
  textoCargando?: string;
  peligro?: boolean;
  cargando?: boolean;
  error?: string | null;
  alConfirmar: () => void;
  alCancelar: () => void;
}

// Solo para confirmar acciones destructivas o irreversibles (design-reference 8.5)
export function Dialogo({
  abierto,
  titulo,
  children,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  textoCargando,
  peligro = false,
  cargando = false,
  error,
  alConfirmar,
  alCancelar,
}: DialogoProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idTexto = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={dialogo}
      className={styles.dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      onClose={alCancelar}
    >
      {abierto && (
        <>
          <h2 id={idTitulo} className={styles.titulo}>
            {titulo}
          </h2>
          <div id={idTexto} className={styles.texto}>
            {children}
          </div>
          {error && <Alerta>{error}</Alerta>}
          <div className={styles.acciones}>
            <Button variante="secundario" onClick={alCancelar} autoFocus>
              {textoCancelar}
            </Button>
            <Button
              variante={peligro ? 'peligro' : 'primario'}
              cargando={cargando}
              textoCargando={textoCargando}
              onClick={alConfirmar}
            >
              {textoConfirmar}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
