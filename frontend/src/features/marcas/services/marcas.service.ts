import { apiClient } from '../../../services/api/client';
import type { DatosMarca, Marca } from '../types/marcas.types';

export const marcasService = {
  async listar(filtros: { search?: string; activo?: boolean } = {}): Promise<Marca[]> {
    const { data } = await apiClient.get<Marca[]>('/marcas', { params: filtros });
    return data;
  },

  async crear(datos: DatosMarca): Promise<Marca> {
    const { data } = await apiClient.post<Marca>('/marcas', datos);
    return data;
  },

  async actualizar(id: string, datos: DatosMarca): Promise<Marca> {
    const { data } = await apiClient.patch<Marca>(`/marcas/${id}`, datos);
    return data;
  },

  async cambiarEstado(id: string, activo: boolean): Promise<Marca> {
    const { data } = await apiClient.post<Marca>(`/marcas/${id}/${activo ? 'activar' : 'desactivar'}`);
    return data;
  },
};
