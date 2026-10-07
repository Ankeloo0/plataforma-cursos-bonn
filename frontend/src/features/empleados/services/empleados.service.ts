import { apiClient } from '../../../services/api/client';
import type { Paginado } from '../../../types/api.types';
import type { DatosEmpleado, Empleado, FiltrosEmpleados } from '../types/empleados.types';

// Activar, desactivar, desbloquear y restablecer usan /usuarios con el usuarioId del empleado
export const empleadosService = {
  async listar(filtros: FiltrosEmpleados): Promise<Paginado<Empleado>> {
    const { data } = await apiClient.get<Paginado<Empleado>>('/empleados', {
      params: {
        page: filtros.page,
        limit: filtros.limit,
        search: filtros.search || undefined,
        sucursalId: filtros.sucursalId || undefined,
        areaId: filtros.areaId || undefined,
        puestoId: filtros.puestoId || undefined,
        activo: filtros.activo === 'todos' ? undefined : filtros.activo,
      },
    });
    return data;
  },

  async obtener(id: string): Promise<Empleado> {
    const { data } = await apiClient.get<Empleado>(`/empleados/${id}`);
    return data;
  },

  async crear(datos: DatosEmpleado & { passwordTemporal: string }): Promise<Empleado> {
    const { data } = await apiClient.post<Empleado>('/empleados', datos);
    return data;
  },

  async actualizar(id: string, datos: DatosEmpleado): Promise<Empleado> {
    const { data } = await apiClient.patch<Empleado>(`/empleados/${id}`, datos);
    return data;
  },

  async cambiarFoto(id: string, foto: File): Promise<Empleado> {
    const formulario = new FormData();
    formulario.append('foto', foto);
    const { data } = await apiClient.put<Empleado>(`/empleados/${id}/foto`, formulario);
    return data;
  },

  async quitarFoto(id: string): Promise<Empleado> {
    const { data } = await apiClient.delete<Empleado>(`/empleados/${id}/foto`);
    return data;
  },

  async restablecerPassword(usuarioId: string, passwordTemporal: string): Promise<void> {
    await apiClient.post(`/usuarios/${usuarioId}/restablecer-password`, { passwordTemporal });
  },

  async cambiarEstado(usuarioId: string, activo: boolean): Promise<void> {
    await apiClient.post(`/usuarios/${usuarioId}/${activo ? 'activar' : 'desactivar'}`);
  },

  async desbloquear(usuarioId: string): Promise<void> {
    await apiClient.post(`/usuarios/${usuarioId}/desbloquear`);
  },
};
