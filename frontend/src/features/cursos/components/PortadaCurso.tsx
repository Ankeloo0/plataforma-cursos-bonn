import logo from '../../../assets/grupo-bonn-logo.png';
import styles from './PortadaCurso.module.css';

// Portada 16:9 (design-reference 8.3). Sin imagen se muestra el logotipo de Grupo Bonn sobre el
// tinte azul; el logotipo de la marca como portada por defecto llega con los destinos (I4, RF-04.2).
export function PortadaCurso({ src, titulo }: { src: string | null; titulo: string }) {
  return (
    <div className={styles.portada}>
      {src ? <img src={src} alt={titulo} className={styles.imagen} /> : <img src={logo} alt="" className={styles.generica} />}
    </div>
  );
}
