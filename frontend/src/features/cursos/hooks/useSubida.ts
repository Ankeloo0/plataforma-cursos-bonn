import { useEffect, useRef, useState } from 'react';
import type { ApiError } from '../../../services/api/client';
import { contenidoService } from '../services/contenido.service';
import type { ArchivoSubido, TipoMaterial } from '../types/contenido.types';
import { ARCHIVO_POR_TIPO, esTipoArchivo, TIPOS_MATERIAL } from '../utils/material';

export type EstadoSubida =
  | { fase: 'vacio' }
  | { fase: 'subiendo'; archivo: File; progreso: number }
  | { fase: 'listo'; archivo: File; subido: ArchivoSubido }
  | { fase: 'error'; archivo: File; mensaje: string };

// Subida de un material como en Udemy (RF-04.5): empieza al elegir el archivo, muestra su avance y se
// puede cancelar. Un archivo subido que no se llega a guardar se borra al cancelar o al cerrar el
// formulario; si la pagina se cierra de golpe, la limpieza diaria de la API lo borra.
export function useSubida(tipo: TipoMaterial) {
  const [estado, setEstado] = useState<EstadoSubida>({ fase: 'vacio' });
  const peticion = useRef<AbortController | null>(null);
  // El archivo subido que todavia no usa ningun material
  const sinUsar = useRef<string | null>(null);

  function descartar() {
    peticion.current?.abort();
    peticion.current = null;
    if (sinUsar.current) {
      // Si falla, la limpieza diaria lo borra
      contenidoService.descartarArchivo(sinUsar.current).catch(() => undefined);
      sinUsar.current = null;
    }
  }

  async function elegir(archivo: File) {
    if (!esTipoArchivo(tipo)) return;
    descartar();
    const { maximo } = ARCHIVO_POR_TIPO[tipo];
    if (archivo.size > maximo) {
      setEstado({ fase: 'error', archivo, mensaje: `El archivo pesa más de ${maximo / (1024 * 1024)} MB, el máximo para este tipo.` });
      return;
    }

    const controlador = new AbortController();
    peticion.current = controlador;
    setEstado({ fase: 'subiendo', archivo, progreso: 0 });
    try {
      const subido = await contenidoService.subirArchivo(
        archivo,
        (progreso) => setEstado({ fase: 'subiendo', archivo, progreso }),
        controlador.signal,
      );
      if (controlador.signal.aborted) return;
      peticion.current = null;
      if (subido.tipoMaterial !== tipo) {
        contenidoService.descartarArchivo(subido.id).catch(() => undefined);
        const real = TIPOS_MATERIAL[subido.tipoMaterial].etiqueta.toLowerCase();
        setEstado({ fase: 'error', archivo, mensaje: `Este archivo es un ${real}. Elige otro archivo o cambia el tipo de material.` });
        return;
      }
      sinUsar.current = subido.id;
      setEstado({ fase: 'listo', archivo, subido });
    } catch (error) {
      // Cancelado por quien sube: el estado ya lo dejo cancelar()
      if (controlador.signal.aborted) return;
      peticion.current = null;
      setEstado({ fase: 'error', archivo, mensaje: (error as ApiError).message });
    }
  }

  function cancelar() {
    descartar();
    setEstado({ fase: 'vacio' });
  }

  function reintentar() {
    if (estado.fase === 'error') void elegir(estado.archivo);
  }

  // Mientras se guarda el material el archivo ya tiene dueno y no se borra al cerrar.
  // Si el guardado falla, vuelve a quedar sin usar.
  function marcarUsado(usado: boolean) {
    sinUsar.current = !usado && estado.fase === 'listo' ? estado.subido.id : null;
  }

  // Mientras sube, cerrar o recargar la pestana pide confirmar
  const subiendo = estado.fase === 'subiendo';
  useEffect(() => {
    if (!subiendo) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [subiendo]);

  // Al cerrar el formulario se cancela lo que quedo a medias
  useEffect(() => descartar, []);

  return { estado, elegir, cancelar, reintentar, marcarUsado };
}
