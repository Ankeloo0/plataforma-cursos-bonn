import { urlArchivo } from '../../archivos/archivos.service.js';
import type { CursoDetalle } from '../cursos.repository.js';
import type { EstadoCurso } from '../entities/curso.entity.js';

export interface AccionesCurso {
  puedeEditar: boolean;
  puedePublicar: boolean;
  puedeArchivar: boolean;
}

export class CursoResponseDto {
  id: string;
  titulo: string;
  descripcion: string | null;
  // null = la interfaz muestra la portada generica (RF-04.2)
  portadaUrl: string | null;
  // Suma de la duracion de sus videos; 0 si todavia no tiene (D-36)
  duracionHoras: number;
  esObligatorio: boolean;
  fechaLimite: string | null;
  calificacionMinima: number;
  estado: EstadoCurso;
  publicadoEn: string | null;
  // Si quien consulta puede editarlo: la interfaz muestra o no la accion Editar (V-10)
  puedeEditar: boolean;
  //publicar y reactivar
  puedePublicar: boolean;
  puedeArchivar: boolean;
  // Quien lo creo y quien lo modifico por ultima vez (RF-04.10). actualizadoEn tambien sirve para V-13.
  creadoEn: string;
  creadoPor: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;

  static desde({ curso, creadoPorNombre, actualizadoPorNombre }: CursoDetalle, acciones: AccionesCurso): CursoResponseDto {
    return {
      id: curso.id,
      titulo: curso.titulo,
      descripcion: curso.descripcion,
      portadaUrl: urlArchivo(curso.imagenArchivoId),
      duracionHoras: Number(curso.duracionHoras),
      esObligatorio: curso.esObligatorio,
      fechaLimite: curso.fechaLimite,
      calificacionMinima: Number(curso.calificacionMinima),
      estado: curso.estado,
      publicadoEn: curso.publicadoEn?.toISOString() ?? null,
      ...acciones,
      creadoEn: curso.creadoEn.toISOString(),
      creadoPor: creadoPorNombre,
      actualizadoEn: curso.actualizadoEn.toISOString(),
      actualizadoPor: curso.actualizadoPor ? actualizadoPorNombre : null,
    };
  }
}
