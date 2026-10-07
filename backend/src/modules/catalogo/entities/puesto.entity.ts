import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

// Puesto = tipo de empleado (P-01); el area del empleado sale de aqui (D-08)
@Entity('puestos')
export class Puesto extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'area_id', type: 'uuid' })
  areaId: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
