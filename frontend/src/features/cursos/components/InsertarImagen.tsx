import { ImagePlus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import type { ApiError } from '../../../services/api/client';
import { contenidoService } from '../services/contenido.service';
import type { ArchivoSubido } from '../types/contenido.types';
import { ARCHIVO_POR_TIPO } from '../utils/material';
import styles from './EditorArticulo.module.css';

type Estado =
  | { fase: 'elegir'; error?: string }
  | { fase: 'subiendo'; nombre: string; progreso: number }
  | { fase: 'lista'; subido: ArchivoSubido; descripcion: string; error?: string };

const { accept, maximo } = ARCHIVO_POR_TIPO.IMAGEN;

// Panel del editor de paginas para subir una imagen y escribir su descripcion (texto alternativo).
// La imagen se sube con POST /archivos, como cualquier material; al guardar la pagina queda ligada a ella (D-39).
export function InsertarImagen({ alInsertar, alCerrar }: { alInsertar: (src: string, alt: string) => void; alCerrar: () => void }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'elegir' });
  const entrada = useRef<HTMLInputElement>(null);
  const peticion = useRef<AbortController | null>(null);
  //imagen subida que todavia no se inserta; si el panel se cierra, se descarta
  const sinUsar = useRef<string | null>(null);

  function descartar() {
    peticion.current?.abort();
    peticion.current = null;
    if (sinUsar.current) {
      //si falla, la limpieza diaria la borra
      contenidoService.descartarArchivo(sinUsar.current).catch(() => undefined);
      sinUsar.current = null;
    }
  }

  useEffect(() => descartar, []);

  async function subir(archivo: File) {
    if (archivo.size > maximo) {
      setEstado({ fase: 'elegir', error: `La imagen pesa más de ${maximo / (1024 * 1024)} MB.` });
      return;
    }
    const controlador = new AbortController();
    peticion.current = controlador;
    setEstado({ fase: 'subiendo', nombre: archivo.name, progreso: 0 });
    try {
      const subido = await contenidoService.subirArchivo(
        archivo,
        (progreso) => setEstado({ fase: 'subiendo', nombre: archivo.name, progreso }),
        controlador.signal,
      );
      peticion.current = null;
      if (subido.tipoMaterial !== 'IMAGEN') {
        contenidoService.descartarArchivo(subido.id).catch(() => undefined);
        setEstado({ fase: 'elegir', error: 'Ese archivo no es una imagen. Elige un JPG, PNG o WebP.' });
        return;
      }
      sinUsar.current = subido.id;
      setEstado({ fase: 'lista', subido, descripcion: '' });
    } catch (error) {
      if (controlador.signal.aborted) return;
      peticion.current = null;
      setEstado({ fase: 'elegir', error: (error as ApiError).message });
    }
  }

  function insertar() {
    if (estado.fase !== 'lista') return;
    const descripcion = estado.descripcion.trim();
    if (!descripcion) {
      setEstado({ ...estado, error: 'Describe la imagen en pocas palabras. Lo leen quienes usan lector de pantalla.' });
      return;
    }
    //ya es parte de la pagina: no se descarta al cerrar
    sinUsar.current = null;
    alInsertar(`/api/v1/archivos/${estado.subido.id}/contenido`, descripcion);
  }

  function cerrar() {
    descartar();
    alCerrar();
  }

  // Enter no debe enviar el formulario del material
  function tecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      insertar();
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      cerrar();
    }
  }

  return (
    <div className={styles.enlace}>
      {estado.fase === 'elegir' && (
        <>
          <input
            ref={entrada}
            type="file"
            accept={accept}
            hidden
            onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              evento.target.value = '';
              if (archivo) void subir(archivo);
            }}
          />
          <p className={styles.ayudaImagen}>JPG, PNG o WebP de hasta 50 MB. Se guarda a 1280 px en su lado mayor.</p>
          {estado.error && <Alerta>{estado.error}</Alerta>}
          <div className={styles.accionesEnlace}>
            <Button tamano="compacto" icono={ImagePlus} onClick={() => entrada.current?.click()}>
              Elegir imagen
            </Button>
            <Button tamano="compacto" variante="texto" onClick={cerrar}>
              Cancelar
            </Button>
          </div>
        </>
      )}

      {estado.fase === 'subiendo' && (
        <>
          <p className={styles.ayudaImagen}>
            Subiendo {estado.nombre}… <span className="cifras-tabulares">{estado.progreso} %</span>
          </p>
          <progress className={styles.progreso} max={100} value={estado.progreso} aria-label={`Subiendo ${estado.nombre}`} />
          <div className={styles.accionesEnlace}>
            <Button tamano="compacto" variante="texto" onClick={cerrar}>
              Cancelar
            </Button>
          </div>
        </>
      )}

      {estado.fase === 'lista' && (
        <>
          <Input
            etiqueta="Descripción de la imagen"
            ayuda="Qué muestra, en pocas palabras. Lo leen quienes usan lector de pantalla."
            autoComplete="off"
            autoFocus
            maxLength={150}
            value={estado.descripcion}
            error={estado.error}
            onChange={(evento) => setEstado({ ...estado, descripcion: evento.target.value, error: undefined })}
            onKeyDown={tecla}
          />
          <div className={styles.accionesEnlace}>
            <Button tamano="compacto" onClick={insertar}>
              Insertar imagen
            </Button>
            <Button tamano="compacto" variante="texto" onClick={cerrar}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
