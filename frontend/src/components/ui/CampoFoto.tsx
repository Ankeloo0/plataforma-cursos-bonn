import { ImageUp, Trash2, UserRound } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { Button } from './Button';
import styles from './CampoFoto.module.css';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAXIMO_BYTES = 5 * 1024 * 1024;

export interface CampoFotoProps {
  // Datos para mostrar las iniciales cuando no hay foto
  idPersona: string;
  nombres: string;
  apellidoPaterno?: string;
  fotoActual: string | null;
  // undefined = sin cambios; File = foto nueva; null = quitar la foto
  valor: File | null | undefined;
  alCambiar: (valor: File | null | undefined) => void;
}

// Foto de perfil con vista previa (P-45). La API vuelve a validar el tipo real y la recorta a 512 x 512.
export function CampoFoto({ idPersona, nombres, apellidoPaterno, fotoActual, valor, alCambiar }: CampoFotoProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const idAyuda = useId();
  const [error, setError] = useState<string | null>(null);
  const vistaPrevia = useMemo(() => (valor instanceof File ? URL.createObjectURL(valor) : null), [valor]);

  useEffect(() => {
    return () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  const mostrada = valor === null ? null : (vistaPrevia ?? fotoActual);

  function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) {
      setError('Elige una imagen JPG, PNG o WebP.');
      return;
    }
    if (archivo.size > MAXIMO_BYTES) {
      setError('La foto pesa más de 5 MB. Elige una imagen más ligera.');
      return;
    }
    setError(null);
    alCambiar(archivo);
  }

  return (
    <div className={styles.campo}>
      {!mostrada && !nombres.trim() ? (
        // Todavia no hay nombre para las iniciales
        <span className={styles.sinNombre} aria-hidden="true">
          <UserRound size={40} strokeWidth={1.75} />
        </span>
      ) : (
        <Avatar id={idPersona} nombres={nombres} apellidoPaterno={apellidoPaterno} src={mostrada} tamano={96} decorativo />
      )}
      <div className={styles.controles}>
        <span className={styles.etiqueta}>Foto de perfil</span>
        <div className={styles.botones}>
          <Button variante="secundario" tamano="compacto" icono={ImageUp} onClick={() => entrada.current?.click()} aria-describedby={idAyuda}>
            {mostrada ? 'Cambiar foto' : 'Elegir foto'}
          </Button>
          {mostrada && (
            <Button variante="texto" icono={Trash2} onClick={() => alCambiar(fotoActual ? null : undefined)}>
              Quitar
            </Button>
          )}
        </div>
        <p id={idAyuda} className={error ? styles.error : styles.ayuda} aria-live="polite">
          {error ?? 'JPG, PNG o WebP de hasta 5 MB. Se recorta en cuadrado.'}
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
    </div>
  );
}
