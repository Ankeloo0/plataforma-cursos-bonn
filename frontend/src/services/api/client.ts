import axios, { AxiosError } from 'axios';

// Formato de error que devuelve la API (technical-spec 4.5).
export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
}

// Unica instancia de Axios de la aplicacion.
// Los componentes nunca llaman a Axios directamente: usan los services de cada feature.
//
// - baseURL relativa: en desarrollo Vite redirige /api a la API; en produccion nginx hace lo mismo.
// - withCredentials: la sesion viaja en una cookie httpOnly que JavaScript no puede leer (T-05).
export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 15_000,
});

// Rutas cuyo 401 es parte del flujo normal y no una sesion expirada
const RUTAS_SIN_REDIRECCION = ['/auth/login', '/auth/login-empleado', '/auth/me'];

let manejarSesionExpirada: (() => void) | null = null;
let manejarPermisoDenegado: (() => void) | null = null;

// El store de sesion se registra aqui; asi el cliente no depende de ningun feature
export function alExpirarSesion(manejador: () => void): void {
  manejarSesionExpirada = manejador;
}

// Un 403 puede significar que el superusuario acaba de quitar un permiso: se vuelve a pedir la sesion
export function alDenegarPermiso(manejador: () => void): void {
  manejarPermisoDenegado = manejador;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[]; code?: string }>) => {
    if (error.response?.status === 401 && !RUTAS_SIN_REDIRECCION.includes(error.config?.url ?? '')) {
      manejarSesionExpirada?.();
    }
    if (error.response?.status === 403 && error.response.data?.code === 'SIN_PERMISO') {
      manejarPermisoDenegado?.();
    }

    const data = error.response?.data;
    const message = Array.isArray(data?.message) ? data.message.join('. ') : data?.message;

    const apiError: ApiError = {
      statusCode: error.response?.status ?? 0,
      message: message ?? 'No se pudo conectar con el servidor. Revisa que estés conectado a la red de la empresa.',
      code: data?.code,
    };
    return Promise.reject(apiError);
  },
);
