import { apiClient } from '../../../services/api/client';
import type { Perfil } from '../../auth/types/auth.types';

export const perfilService = {
  async obtener(): Promise<Perfil> {
    const { data } = await apiClient.get<Perfil>('/perfil');
    return data;
  },

  async cambiarFoto(foto: File): Promise<Perfil> {
    const formulario = new FormData();
    formulario.append('foto', foto);
    const { data } = await apiClient.put<Perfil>('/perfil/foto', formulario);
    return data;
  },

  async quitarFoto(): Promise<Perfil> {
    const { data } = await apiClient.delete<Perfil>('/perfil/foto');
    return data;
  },
};
