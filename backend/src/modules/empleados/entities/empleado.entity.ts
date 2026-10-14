import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

// Solo datos laborales: nombre, foto, sucursal y numero de empleado estan en usuarios (D-18)
@Entity('empleados')
export class Empleado extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'puesto_id', type: 'uuid' })
  puestoId: string;

  // Columna date: TypeORM la entrega como texto 'YYYY-MM-DD'
  @Column({ name: 'fecha_ingreso', type: 'date' })
  fechaIngreso: string;
}
