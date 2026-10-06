import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

@Entity('marcas')
export class Marca extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  @Column({ name: 'logo_archivo_id', type: 'uuid', nullable: true })
  logoArchivoId: string | null;

  // Se agregan a las instrucciones globales del asistente para los empleados de la marca (D-31)
  @Column({ name: 'instrucciones_asistente', type: 'text', nullable: true })
  instruccionesAsistente: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
