import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

// Solo datos laborales: nombre, foto y sucursal estan en usuarios (D-18)
@Entity('empleados')
export class Empleado extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  // Empresa de su sucursal. Con ella la base garantiza el numero unico por empresa (D-34, V-03).
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @Column({ name: 'numero_empleado', type: 'varchar', length: 20 })
  numeroEmpleado: string;

  @Column({ name: 'puesto_id', type: 'uuid' })
  puestoId: string;

  // Columna date: TypeORM la entrega como texto 'YYYY-MM-DD'
  @Column({ name: 'fecha_ingreso', type: 'date' })
  fechaIngreso: string;
}
