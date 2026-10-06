import { useState } from 'react';
import styles from './Avatar.module.css';
import { FONDOS_INICIALES, indiceDeColor, iniciales } from './avatar.utils';

export type TamanoAvatar = 24 | 32 | 40 | 96;

export interface AvatarProps {
  // Id del usuario: decide el color de las iniciales, siempre el mismo para la misma persona.
  id: string;
  nombres: string;
  apellidoPaterno?: string;
  // URL de la foto. Sin foto, o si no carga, se muestran las iniciales.
  src?: string | null;
  tamano?: TamanoAvatar;
  // Borde blanco de 2 px, para fotos que se superponen.
  superpuesto?: boolean;
  // Si el nombre ya esta escrito junto a la foto (tablas, encabezado), el lector de pantalla no lo repite.
  decorativo?: boolean;
}

// Foto de perfil circular o, si no hay, las iniciales (design-reference.md 8.5).
export function Avatar({
  id,
  nombres,
  apellidoPaterno,
  src,
  tamano = 40,
  superpuesto = false,
  decorativo = false,
}: AvatarProps) {
  const [fotoFallida, setFotoFallida] = useState<string | null>(null);
  const nombreCompleto = [nombres, apellidoPaterno].filter(Boolean).join(' ');
  const clases = [styles.avatar, styles[`t${tamano}`], superpuesto && styles.superpuesto].filter(Boolean).join(' ');

  if (src && fotoFallida !== src) {
    return (
      <img
        className={clases}
        src={src}
        alt={decorativo ? '' : nombreCompleto}
        width={tamano}
        height={tamano}
        onError={() => setFotoFallida(src)}
      />
    );
  }

  return (
    <span
      className={clases}
      style={{ background: FONDOS_INICIALES[indiceDeColor(id)] }}
      role={decorativo ? undefined : 'img'}
      aria-label={decorativo ? undefined : nombreCompleto}
      aria-hidden={decorativo || undefined}
    >
      {iniciales(nombres, apellidoPaterno)}
    </span>
  );
}
