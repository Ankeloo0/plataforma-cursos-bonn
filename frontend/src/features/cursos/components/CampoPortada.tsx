import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import styles from './CampoPortada.module.css';
import { PortadaCurso } from './PortadaCurso';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAXIMO_BYTES = 50 * 1024 * 1024;

// Portada del curso con vista previa. La API vuelve a validar el tipo real y la reduce a 1280 px (RF-04.6).
export function CampoPortada({
  titulo,
  portadaActual,
  valor,
  alCambiar,
}: {
  titulo: string;
  portadaActual: string | null;
  // undefined = sin cambios; File = portada nueva; null = quitarla
  valor: File | null | undefined;
  alCambiar: (valor: File | null | undefined) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const idAyuda = useId();
  const [error, setError] = useState<string | null>(null);
  const vistaPrevia = useMemo(() => (valor instanceof File ? URL.createObjectURL(valor) : null), [valor]);

  useEffect(() => {
    return () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  const mostrada = valor === null ? null : (vistaPrevia ?? portadaActual);

  function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) {
      setError('Elige una imagen JPG, PNG o WebP.');
      return;
    }
    if (archivo.size > MAXIMO_BYTES) {
      setError('La portada pesa más de 50 MB. Elige una imagen más ligera.');
      return;
    }
    setError(null);
    alCambiar(archivo);
  }

  return (
    <div className={styles.campo}>
      <span className={styles.etiqueta}>Portada</span>
      <PortadaCurso src={mostrada} titulo={titulo || 'Portada del curso'} />
      <div className={styles.botones}>
        <Button variante="secundario" tamano="compacto" icono={ImageUp} onClick={() => entrada.current?.click()} aria-describedby={idAyuda}>
          {mostrada ? 'Cambiar portada' : 'Elegir portada'}
        </Button>
        {mostrada && (
          <Button variante="texto" icono={Trash2} onClick={() => alCambiar(portadaActual ? null : undefined)}>
            Quitar
          </Button>
        )}
      </div>
      <p id={idAyuda} className={error ? styles.error : styles.ayuda} aria-live="polite">
        {error ?? 'Opcional. JPG, PNG o WebP de hasta 50 MB; se ve mejor horizontal (16:9). Sin portada se muestra la genérica.'}
      </p>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS.join(',')}
        hidden
        onChange={(e) => {
          alElegir(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
