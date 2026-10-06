import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

@Entity('sucursales')
export class Sucursal extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  // Una marca por sucursal (D-27)
  @Column({ name: 'marca_id', type: 'uuid' })
  marcaId: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  direccion: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
