import { Download, ExternalLink } from 'lucide-react';
import type { Material } from '../types/contenido.types';
import { detalleMaterial, TIPOS_MATERIAL } from '../utils/material';
import styles from './VisorMaterial.module.css';

//el material como lo vera el empleado, segun su tipo
export function VisorMaterial({ material }: { material: Material }) {
  const url = material.archivo?.url ?? null;

  if (material.tipo === 'VIDEO' && url) {
    return <video key={material.id} className={styles.video} src={url} controls preload="metadata" aria-label={material.titulo} />;
  }
  if (material.tipo === 'IMAGEN' && url) {
    return <img className={styles.imagen} src={url} alt={material.titulo} />;
  }
  if (material.tipo === 'ARTICULO') {
    //el html ya viene limpio de la api con una lista permitida de etiquetas
    return <div className={styles.articulo} dangerouslySetInnerHTML={{ __html: material.contenido ?? '' }} />;
  }

  //pdf, documento y enlace se abren en otra pestana: nginx no deja mostrarlos dentro de un iframe
  const destino = material.tipo === 'ENLACE' ? material.urlExterna : url;
  const Icono = TIPOS_MATERIAL[material.tipo].icono;
  const textoBoton = material.tipo === 'ENLACE' ? 'Abrir enlace' : material.tipo === 'PDF' ? 'Abrir PDF' : 'Descargar';

  return (
    <div className={styles.tarjeta}>
      <Icono className={styles.iconoTarjeta} size={32} strokeWidth={1.5} aria-hidden="true" />
      <div className={styles.datosTarjeta}>
        <p className={styles.nombre}>{material.archivo?.nombreOriginal ?? material.titulo}</p>
        <p className={styles.detalle}>{detalleMaterial(material)}</p>
      </div>
      {destino && (
        <a className={styles.boton} href={destino} target="_blank" rel="noopener noreferrer" aria-label={`${textoBoton} (se abre en otra pestaña)`}>
          {material.tipo === 'DOCUMENTO' ? <Download size={20} strokeWidth={1.75} aria-hidden="true" /> : <ExternalLink size={20} strokeWidth={1.75} aria-hidden="true" />}
          {textoBoton}
        </a>
      )}
    </div>
  );
}
