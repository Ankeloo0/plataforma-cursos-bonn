import { apiClient } from '../../../services/api/client';
import type { Paginado } from '../../../types/api.types';
import type { Curso, DatosCurso, FiltrosCursos } from '../types/cursos.types';

export const cursosService = {
  async listar(filtros: FiltrosCursos): Promise<Paginado<Curso>> {
    const { data } = await apiClient.get<Paginado<Curso>>('/cursos', {
      params: {
        page: filtros.page,
        limit: filtros.limit,
        search: filtros.search || undefined,
        estado: filtros.estado === 'todos' ? undefined : filtros.estado,
      },
    });
    return data;
  },

  async obtener(id: string): Promise<Curso> {
    const { data } = await apiClient.get<Curso>(`/cursos/${id}`);
    return data;
  },

  async crear(datos: DatosCurso): Promise<Curso> {
    const { data } = await apiClient.post<Curso>('/cursos', datos);
    return data;
  },

  // actualizadoEn: el que se leyo; si alguien guardo antes, la API responde 409 CURSO_MODIFICADO (V-13)
  async actualizar(id: string, datos: DatosCurso, actualizadoEn: string): Promise<Curso> {
    const { data } = await apiClient.patch<Curso>(`/cursos/${id}`, { ...datos, actualizadoEn });
    return data;
  },

  async cambiarPortada(id: string, portada: File): Promise<Curso> {
    const formulario = new FormData();
    formulario.append('portada', portada);
    // Una imagen grande tarda mas en subir que el tiempo limite general
    const { data } = await apiClient.put<Curso>(`/cursos/${id}/portada`, formulario, { timeout: 120_000 });
    return data;
  },

  async quitarPortada(id: string): Promise<Curso> {
    const { data } = await apiClient.delete<Curso>(`/cursos/${id}/portada`);
    return data;
  },
};
