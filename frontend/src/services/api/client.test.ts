import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient, type ApiError } from './client';

type RejectedHandler = (error: unknown) => Promise<never>;

function interceptorDeError(): RejectedHandler {
  // Axios guarda los interceptores registrados en `handlers`.
  const handlers = (apiClient.interceptors.response as unknown as { handlers: { rejected: RejectedHandler }[] }).handlers;
  return handlers[0].rejected;
}

function errorDeAxios(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fallo', 'ERR', config, null, { status, statusText: '', headers: {}, config, data });
}

describe('apiClient', () => {
  it('usa la ruta relativa de la API y envía la cookie de sesión', () => {
    expect(apiClient.defaults.baseURL).toBe('/api/v1');
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it('convierte un error de la API al formato { statusCode, message, code }', async () => {
    const error = errorDeAxios(409, { message: 'El número de empleado ya existe', code: 'EMPLEADO_NUMERO_DUPLICADO' });

    await expect(interceptorDeError()(error)).rejects.toEqual<ApiError>({
      statusCode: 409,
      message: 'El número de empleado ya existe',
      code: 'EMPLEADO_NUMERO_DUPLICADO',
    });
  });

  it('une los mensajes de validación en un solo texto', async () => {
    const error = errorDeAxios(400, { message: ['username es obligatorio', 'password es obligatorio'] });

    await expect(interceptorDeError()(error)).rejects.toMatchObject({
      message: 'username es obligatorio. password es obligatorio',
    });
  });
});
