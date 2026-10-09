import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

@Entity('temas')
export class Tema extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'curso_id', type: 'uuid' })
  cursoId: string;

  @Column({ type: 'varchar', length: 150 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  // UNIQUE (curso_id, orden): se reordena en dos pasos (database-design 4.3)
  @Column({ type: 'smallint' })
  orden: number;

  // false = oculto (D-32): deja de mostrarse y de contar en el avance y la duracion
  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
