import styles from './Skeleton.module.css';

// Bloque con la forma del contenido que esta cargando (design-reference 8.5)
export function Skeleton({ ancho = '100%', alto = 16 }: { ancho?: string | number; alto?: number }) {
  return <span className={styles.skeleton} style={{ width: ancho, height: alto }} aria-hidden="true" />;
}
