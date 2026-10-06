import { apiClient } from '../../../services/api/client';
import type { Paginado } from '../../../types/api.types';
import type { DatosEmpresa, Empresa, FiltrosEmpresas } from '../types/empresas.types';

export const empresasService = {
  async listar(filtros: FiltrosEmpresas): Promise<Paginado<Empresa>> {
    const { data } = await apiClient.get<Paginado<Empresa>>('/empresas', {
      params: {
        page: filtros.page,
        limit: filtros.limit,
        search: filtros.search || undefined,
        activo: filtros.activo === 'todas' ? undefined : filtros.activo,
      },
    });
    return data;
  },

  async obtener(id: string): Promise<Empresa> {
    const { data } = await apiClient.get<Empresa>(`/empresas/${id}`);
    return data;
  },

  async crear(datos: DatosEmpresa): Promise<Empresa> {
    const { data } = await apiClient.post<Empresa>('/empresas', datos);
    return data;
  },

  async actualizar(id: string, datos: DatosEmpresa): Promise<Empresa> {
    const { data } = await apiClient.patch<Empresa>(`/empresas/${id}`, datos);
    return data;
  },

  async cambiarEstado(id: string, activo: boolean): Promise<Empresa> {
    const { data } = await apiClient.post<Empresa>(`/empresas/${id}/${activo ? 'activar' : 'desactivar'}`);
    return data;
  },
};
