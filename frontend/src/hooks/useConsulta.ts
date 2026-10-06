import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '../services/api/client';

export type Consulta<T> =
  | { estado: 'cargando'; datos: T | null }
  | { estado: 'listo'; datos: T }
  | { estado: 'error'; datos: T | null; error: ApiError };

// Carga los datos que usa una sola pantalla (T-09): estado local, sin store global.
// "cargar" debe venir de useCallback; cuando cambia (por ejemplo, otros filtros) se vuelve a pedir.
// Mientras recarga conserva los datos anteriores para no vaciar la pantalla.
export function useConsulta<T>(cargar: () => Promise<T>) {
  const [consulta, setConsulta] = useState<Consulta<T>>({ estado: 'cargando', datos: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // Si el usuario cambia de filtro antes de que llegue la respuesta, la respuesta vieja se ignora
    let vigente = true;
    // Marca "cargando" al iniciar cada peticion; es un render extra sin costo real
    // oxlint-disable-next-line react/set-state-in-effect
    setConsulta((anterior) => ({ estado: 'cargando', datos: anterior.datos }));
    cargar()
      .then((datos) => {
        if (vigente) setConsulta({ estado: 'listo', datos });
      })
      .catch((error: ApiError) => {
        if (vigente) setConsulta((anterior) => ({ estado: 'error', datos: anterior.datos, error }));
      });
    return () => {
      vigente = false;
    };
  }, [cargar, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const reemplazar = useCallback((datos: T) => setConsulta({ estado: 'listo', datos }), []);

  return { ...consulta, recargar, reemplazar };
}
