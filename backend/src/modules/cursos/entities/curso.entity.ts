import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

// Debe coincidir con el CHECK de cursos.estado (migracion 5)
export const ESTADOS_CURSO = { BORRADOR: 'BORRADOR', PUBLICADO: 'PUBLICADO', ARCHIVADO: 'ARCHIVADO' } as const;
export type EstadoCurso = (typeof ESTADOS_CURSO)[keyof typeof ESTADOS_CURSO];

// El curso no tiene dueno: a quien llega lo dicen sus destinos (I4, D-29)
@Entity('cursos')
export class Curso extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'imagen_archivo_id', type: 'uuid', nullable: true })
  imagenArchivoId: string | null;

  // numeric llega como texto desde pg; se usa numeric y no float para no redondear horas ni calificaciones.
  // La calcula el sistema con la duracion de los videos activos (D-36); nunca la envia el cliente.
  @Column({ name: 'duracion_horas', type: 'numeric', precision: 6, scale: 2, default: 0 })
  duracionHoras: string;

  @Column({ name: 'es_obligatorio', type: 'boolean', default: false })
  esObligatorio: boolean;

  // Columna date: TypeORM la entrega como texto 'YYYY-MM-DD'
  @Column({ name: 'fecha_limite', type: 'date', nullable: true })
  fechaLimite: string | null;

  @Column({ name: 'calificacion_minima', type: 'numeric', precision: 5, scale: 2 })
  calificacionMinima: string;

  @Column({ type: 'varchar', length: 20, default: ESTADOS_CURSO.BORRADOR })
  estado: EstadoCurso;

  @Column({ name: 'publicado_en', type: 'timestamptz', nullable: true })
  publicadoEn: Date | null;
}
