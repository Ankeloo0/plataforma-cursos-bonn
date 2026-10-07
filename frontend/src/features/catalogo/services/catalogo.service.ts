import { apiClient } from '../../../services/api/client';
import type { Area, DatosArea, DatosPuesto, Puesto } from '../types/catalogo.types';

interface Filtros {
  search?: string;
  activo?: boolean;
}

// Catalogo unico de la plataforma (D-25): se lista completo, sin paginar
export const catalogoService = {
  async listarAreas(filtros: Filtros = {}): Promise<Area[]> {
    const { data } = await apiClient.get<Area[]>('/areas', { params: filtros });
    return data;
  },

  async crearArea(datos: DatosArea): Promise<Area> {
    const { data } = await apiClient.post<Area>('/areas', datos);
    return data;
  },

  async actualizarArea(id: string, datos: DatosArea): Promise<Area> {
    const { data } = await apiClient.patch<Area>(`/areas/${id}`, datos);
    return data;
  },

  async cambiarEstadoArea(id: string, activo: boolean): Promise<Area> {
    const { data } = await apiClient.post<Area>(`/areas/${id}/${activo ? 'activar' : 'desactivar'}`);
    return data;
  },

  async listarPuestos(filtros: Filtros & { areaId?: string } = {}): Promise<Puesto[]> {
    const { data } = await apiClient.get<Puesto[]>('/puestos', { params: filtros });
    return data;
  },

  async crearPuesto(datos: DatosPuesto): Promise<Puesto> {
    const { data } = await apiClient.post<Puesto>('/puestos', datos);
    return data;
  },

  async actualizarPuesto(id: string, datos: DatosPuesto): Promise<Puesto> {
    const { data } = await apiClient.patch<Puesto>(`/puestos/${id}`, datos);
    return data;
  },

  async cambiarEstadoPuesto(id: string, activo: boolean): Promise<Puesto> {
    const { data } = await apiClient.post<Puesto>(`/puestos/${id}/${activo ? 'activar' : 'desactivar'}`);
    return data;
  },
};
