import { apiClient } from '../../../services/api/client';
import type { DatosSucursal, Sucursal } from '../types/empresas.types';

export const sucursalesService = {
  async listarDeEmpresa(empresaId: string): Promise<Sucursal[]> {
    const { data } = await apiClient.get<Sucursal[]>(`/empresas/${empresaId}/sucursales`);
    return data;
  },

  // El superusuario recibe todas; un administrador, solo las de su alcance
  async listarEnAlcance(): Promise<Sucursal[]> {
    const { data } = await apiClient.get<Sucursal[]>('/sucursales');
    return data;
  },

  async crear(empresaId: string, datos: DatosSucursal): Promise<Sucursal> {
    const { data } = await apiClient.post<Sucursal>(`/empresas/${empresaId}/sucursales`, datos);
    return data;
  },

  async actualizar(id: string, datos: Partial<DatosSucursal>): Promise<Sucursal> {
    const { data } = await apiClient.patch<Sucursal>(`/sucursales/${id}`, datos);
    return data;
  },

  async cambiarEstado(id: string, activo: boolean): Promise<Sucursal> {
    const { data } = await apiClient.post<Sucursal>(`/sucursales/${id}/${activo ? 'activar' : 'desactivar'}`);
    return data;
  },
};
