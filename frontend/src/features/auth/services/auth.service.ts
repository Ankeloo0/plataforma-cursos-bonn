import { apiClient } from '../../../services/api/client';
import type { EmpresaLogin, Perfil } from '../types/auth.types';

export const authService = {
  async iniciarSesion(username: string, password: string): Promise<Perfil> {
    const { data } = await apiClient.post<Perfil>('/auth/login', { username, password });
    return data;
  },

  async iniciarSesionEmpleado(empresaId: string, numeroEmpleado: string, password: string): Promise<Perfil> {
    const { data } = await apiClient.post<Perfil>('/auth/login-empleado', { empresaId, numeroEmpleado, password });
    return data;
  },

  async listarEmpresas(): Promise<EmpresaLogin[]> {
    const { data } = await apiClient.get<EmpresaLogin[]>('/auth/empresas');
    return data;
  },

  async cerrarSesion(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async obtenerSesion(): Promise<Perfil> {
    const { data } = await apiClient.get<Perfil>('/auth/me');
    return data;
  },

  async cambiarPassword(passwordActual: string, passwordNueva: string): Promise<Perfil> {
    const { data } = await apiClient.post<Perfil>('/auth/cambiar-password', { passwordActual, passwordNueva });
    return data;
  },
};
