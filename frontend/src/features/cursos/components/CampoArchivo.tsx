import { CircleAlert, CircleCheck, CloudUpload, RotateCw, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { EstadoSubida } from '../hooks/useSubida';
import type { ArchivoDeMaterial, TipoArchivo } from '../types/contenido.types';
import { ARCHIVO_POR_TIPO, TIPOS_MATERIAL, tamano } from '../utils/material';
import styles from './CampoArchivo.module.css';

// Archivo de un material: se elige con el boton o se suelta en la zona, y la subida empieza al momento
export function CampoArchivo({
  tipo,
  estado,
  actual,
  alElegir,
  alCancelar,
  alReintentar,
}: {
  tipo: TipoArchivo;
  estado: EstadoSubida;
  // Al editar: el archivo que ya tiene el material
  actual?: ArchivoDeMaterial | null;
  alElegir: (archivo: File) => void;
  alCancelar: () => void;
  alReintentar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const idEtiqueta = useId();
  const idAyuda = useId();
  const [encima, setEncima] = useState(false);
  const { accept, ayuda } = ARCHIVO_POR_TIPO[tipo];
  const Icono = TIPOS_MATERIAL[tipo].icono;
  const elegir = () => entrada.current?.click();

  let contenido;
  if (estado.fase === 'subiendo') {
    contenido = (
      <div className={styles.archivo}>
        <Icono className={styles.iconoArchivo} size={20} strokeWidth={1.75} aria-hidden="true" />
        <div className={styles.datos}>
          <span className={styles.nombre}>{estado.archivo.name}</span>
          <div className={styles.avance}>
            <div
              className={styles.barra}
              role="progressbar"
              aria-label={`Subiendo ${estado.archivo.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={estado.progreso}
            >
              <span style={{ width: `${estado.progreso}%` }} />
            </div>
            <span className={`${styles.secundario} cifras-tabulares`}>{estado.progreso} %</span>
          </div>
          <span className={`${styles.secundario} cifras-tabulares`}>
            Subiendo {tamano(estado.archivo.size)}. Mientras tanto puedes escribir el título.
          </span>
        </div>
        <Button variante="texto" icono={X} onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    );
  } else if (estado.fase === 'listo' || (estado.fase === 'vacio' && actual)) {
    const nombre = estado.fase === 'listo' ? estado.archivo.name : actual!.nombreOriginal;
    const bytes = estado.fase === 'listo' ? estado.subido.tamanoBytes : actual!.tamanoBytes;
    contenido = (
      <div className={styles.archivo}>
        {estado.fase === 'listo' ? (
          <CircleCheck className={styles.iconoListo} size={20} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Icono className={styles.iconoArchivo} size={20} strokeWidth={1.75} aria-hidden="true" />
        )}
        <div className={styles.datos}>
          <span className={styles.nombre}>{nombre}</span>
          <span className={`${styles.secundario} cifras-tabulares`}>
            {estado.fase === 'listo' ? `Subido · ${tamano(bytes)}` : tamano(bytes)}
          </span>
        </div>
        <Button variante="texto" onClick={elegir}>
          Reemplazar
        </Button>
      </div>
    );
  } else if (estado.fase === 'error') {
    contenido = (
      <div className={`${styles.archivo} ${styles.conError}`}>
        <CircleAlert className={styles.iconoError} size={20} strokeWidth={1.75} aria-hidden="true" />
        <div className={styles.datos}>
          <span className={styles.nombre}>{estado.archivo.name}</span>
          <span className={styles.mensajeError} role="alert">
            {estado.mensaje}
          </span>
          <div className={styles.botones}>
            <Button variante="secundario" tamano="compacto" icono={RotateCw} onClick={alReintentar}>
              Reintentar
            </Button>
            <Button variante="texto" onClick={elegir}>
              Elegir otro archivo
            </Button>
            <Button variante="texto" onClick={alCancelar}>
              Descartar
            </Button>
          </div>
        </div>
      </div>
    );
  } else {
    contenido = (
      <div
        className={`${styles.zona} ${encima ? styles.encima : ''}`}
        onDragOver={(evento) => {
          evento.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(evento) => {
          evento.preventDefault();
          setEncima(false);
          const archivo = evento.dataTransfer.files[0];
          if (archivo) alElegir(archivo);
        }}
      >
        <span className={styles.iconoZona}>
          <CloudUpload size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className={styles.textoZona}>Arrastra el archivo aquí o</p>
        <Button variante="secundario" tamano="compacto" onClick={elegir} aria-describedby={idAyuda}>
          Elegir archivo
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.campo} role="group" aria-labelledby={idEtiqueta}>
      <span id={idEtiqueta} className={styles.etiqueta}>
        Archivo <span aria-hidden="true">*</span>
      </span>
      {contenido}
      <p id={idAyuda} className={styles.ayuda}>
        {ayuda}
      </p>
      <div className="solo-lector" aria-live="polite">
        {estado.fase === 'listo' ? `${estado.archivo.name} subido` : ''}
      </div>
      <input
        ref={entrada}
        type="file"
        accept={accept}
        hidden
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          if (archivo) alElegir(archivo);
          evento.target.value = '';
        }}
      />
    </div>
  );
}
