import { apiClient } from '../../../services/api/client';
import { perfil } from '../../../test/sesion';
import { authService } from '../services/auth.service';
import { useAuthStore } from './auth.store';

describe('auth.store', () => {
  afterEach(() => vi.restoreAllMocks());

  it('con una cookie válida queda con sesión; sin ella, sin sesión', async () => {
    vi.spyOn(authService, 'obtenerSesion').mockResolvedValueOnce(perfil());
    await useAuthStore.getState().verificarSesion();
    expect(useAuthStore.getState()).toMatchObject({ estado: 'con-sesion', usuario: { username: 'jperez' } });

    vi.spyOn(authService, 'obtenerSesion').mockRejectedValueOnce({ statusCode: 401 });
    await useAuthStore.getState().verificarSesion();
    expect(useAuthStore.getState()).toMatchObject({ estado: 'sin-sesion', usuario: null });
  });

  it('al cerrar sesión borra el usuario aunque la API no responda', async () => {
    useAuthStore.setState({ usuario: perfil(), estado: 'con-sesion' });
    vi.spyOn(authService, 'cerrarSesion').mockRejectedValueOnce({ statusCode: 0 });

    await useAuthStore.getState().cerrarSesion().catch(() => undefined);
    expect(useAuthStore.getState().usuario).toBeNull();
  });

  it('un 401 en cualquier petición cierra la sesión local (sesión expirada o cerrada en otro lugar)', async () => {
    useAuthStore.setState({ usuario: perfil(), estado: 'con-sesion' });
    const handlers = (apiClient.interceptors.response as unknown as { handlers: { rejected: (e: unknown) => Promise<never> }[] }).handlers;
    const error = { config: { url: '/perfil' }, response: { status: 401, data: {} } };

    await handlers[0].rejected(error).catch(() => undefined);
    expect(useAuthStore.getState()).toMatchObject({ estado: 'sin-sesion', usuario: null });
  });
});
