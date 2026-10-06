import { apiClient } from '../../../services/api/client';
import type { Paginado } from '../../../types/api.types';
import type { Permiso } from '../../auth/types/auth.types';
import type {
  Administrador,
  AdministradorDetalle,
  AdministradorResumen,
  CatalogoPermisos,
  DatosAdministrador,
  FiltrosAdministradores,
} from '../types/administradores.types';

// Activar, desactivar, desbloquear y restablecer usan /usuarios, igual que para los empleados
export const administradoresService = {
  async listar(filtros: FiltrosAdministradores): Promise<Paginado<AdministradorResumen>> {
    const { data } = await apiClient.get<Paginado<AdministradorResumen>>('/administradores', {
      params: {
        page: filtros.page,
        limit: filtros.limit,
        search: filtros.search || undefined,
        activo: filtros.activo === 'todos' ? undefined : filtros.activo,
      },
    });
    return data;
  },

  async obtener(id: string): Promise<AdministradorDetalle> {
    const { data } = await apiClient.get<AdministradorDetalle>(`/administradores/${id}`);
    return data;
  },

  async catalogo(): Promise<CatalogoPermisos> {
    const { data } = await apiClient.get<CatalogoPermisos>('/permisos/catalogo');
    return data;
  },

  async crear(datos: DatosAdministrador & { passwordTemporal: string }): Promise<Administrador> {
    const { data } = await apiClient.post<Administrador>('/administradores', datos);
    return data;
  },

  async actualizar(id: string, datos: DatosAdministrador): Promise<Administrador> {
    const { data } = await apiClient.patch<Administrador>(`/administradores/${id}`, datos);
    return data;
  },

  // Listas completas: lo que no venga se quita (RF-00.8)
  async guardarAcceso(id: string, permisos: Permiso[], sucursalIds: string[]): Promise<AdministradorDetalle> {
    const { data } = await apiClient.put<AdministradorDetalle>(`/administradores/${id}/acceso`, { permisos, sucursalIds });
    return data;
  },

  async cambiarFoto(id: string, foto: File): Promise<Administrador> {
    const formulario = new FormData();
    formulario.append('foto', foto);
    const { data } = await apiClient.put<Administrador>(`/administradores/${id}/foto`, formulario);
    return data;
  },

  async quitarFoto(id: string): Promise<Administrador> {
    const { data } = await apiClient.delete<Administrador>(`/administradores/${id}/foto`);
    return data;
  },

  async restablecerPassword(id: string, passwordTemporal: string): Promise<Administrador> {
    const { data } = await apiClient.post<Administrador>(`/usuarios/${id}/restablecer-password`, { passwordTemporal });
    return data;
  },

  async cambiarEstado(id: string, activo: boolean): Promise<Administrador> {
    const { data } = await apiClient.post<Administrador>(`/usuarios/${id}/${activo ? 'activar' : 'desactivar'}`);
    return data;
  },

  async desbloquear(id: string): Promise<Administrador> {
    const { data } = await apiClient.post<Administrador>(`/usuarios/${id}/desbloquear`);
    return data;
  },
};
