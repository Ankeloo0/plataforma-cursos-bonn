import styles from './PortadaCurso.module.css';

// Portada 16:9 (design-reference 8.3). Sin imagen se muestra la portada generica "Cursos" sobre el
// tinte azul; el logotipo de la marca como portada por defecto llega con los destinos (I4, RF-04.2).
export function PortadaCurso({ src, titulo }: { src: string | null; titulo: string }) {
  return (
    <div className={styles.portada}>
      {src ? (
        <img src={src} alt={titulo} className={styles.imagen} />
      ) : (
        <span className={styles.generica} aria-hidden="true">
          Cursos
        </span>
      )}
    </div>
  );
}
