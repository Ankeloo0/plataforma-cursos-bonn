import { apiClient } from '../../../services/api/client';
import type { ArchivoSubido, DatosMaterial, DatosTema, Material, Tema, TipoMaterial } from '../types/contenido.types';

// Temas y materiales de un curso (RF-04.3, RF-04.4). Cada cambio se guarda al momento.
export const contenidoService = {
  async listarTemas(cursoId: string): Promise<Tema[]> {
    const { data } = await apiClient.get<Tema[]>(`/cursos/${cursoId}/temas`);
    return data;
  },

  async crearTema(cursoId: string, datos: DatosTema): Promise<Tema> {
    const { data } = await apiClient.post<Tema>(`/cursos/${cursoId}/temas`, datos);
    return data;
  },

  // actualizadoEn: el que se leyo; si alguien guardo antes, 409 CURSO_MODIFICADO (V-13)
  async actualizarTema(id: string, datos: DatosTema, actualizadoEn: string): Promise<Tema> {
    const { data } = await apiClient.patch<Tema>(`/temas/${id}`, { ...datos, actualizadoEn });
    return data;
  },

  async cambiarVisibilidadTema(id: string, visible: boolean): Promise<void> {
    await apiClient.post(`/temas/${id}/${visible ? 'mostrar' : 'ocultar'}`);
  },

  async eliminarTema(id: string): Promise<void> {
    await apiClient.delete(`/temas/${id}`);
  },

  async reordenarTemas(cursoId: string, ids: string[]): Promise<void> {
    await apiClient.put(`/cursos/${cursoId}/temas/orden`, { ids });
  },

  async crearMaterial(temaId: string, tipo: TipoMaterial, datos: DatosMaterial): Promise<Material> {
    const { data } = await apiClient.post<Material>(`/temas/${temaId}/materiales`, { tipo, ...datos });
    return data;
  },

  async actualizarMaterial(id: string, datos: DatosMaterial, actualizadoEn: string): Promise<Material> {
    const { data } = await apiClient.patch<Material>(`/materiales/${id}`, { ...datos, actualizadoEn });
    return data;
  },

  async cambiarVisibilidadMaterial(id: string, visible: boolean): Promise<void> {
    await apiClient.post(`/materiales/${id}/${visible ? 'mostrar' : 'ocultar'}`);
  },

  async eliminarMaterial(id: string): Promise<void> {
    await apiClient.delete(`/materiales/${id}`);
  },

  async reordenarMateriales(temaId: string, ids: string[]): Promise<void> {
    await apiClient.put(`/temas/${temaId}/materiales/orden`, { ids });
  },

  // Primer paso de un material (RF-04.5). Sin tiempo limite: un video de 500 MB tarda minutos.
  // senal permite cancelar la subida a la mitad.
  async subirArchivo(archivo: File, alAvanzar: (porcentaje: number) => void, senal: AbortSignal): Promise<ArchivoSubido> {
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    const { data } = await apiClient.post<ArchivoSubido>('/archivos', formulario, {
      timeout: 0,
      signal: senal,
      onUploadProgress: (evento) => {
        if (evento.total) alAvanzar(Math.round((evento.loaded / evento.total) * 100));
      },
    });
    return data;
  },

  // Cancelar un archivo ya subido que no se llego a usar
  async descartarArchivo(id: string): Promise<void> {
    await apiClient.delete(`/archivos/${id}`);
  },
};
