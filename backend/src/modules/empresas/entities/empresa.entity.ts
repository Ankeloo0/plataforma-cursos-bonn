import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

@Entity('empresas')
export class Empresa extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ name: 'razon_social', type: 'varchar', length: 200, nullable: true })
  razonSocial: string | null;

  // Los folios de sus certificados empiezan con este prefijo (D-30)
  @Column({ name: 'prefijo_folio', type: 'varchar', length: 6 })
  prefijoFolio: string;

  @Column({ name: 'logo_archivo_id', type: 'uuid', nullable: true })
  logoArchivoId: string | null;

  @Column({ name: 'firmante_nombre', type: 'varchar', length: 150, nullable: true })
  firmanteNombre: string | null;

  @Column({ name: 'firmante_cargo', type: 'varchar', length: 150, nullable: true })
  firmanteCargo: string | null;

  @Column({ name: 'firma_archivo_id', type: 'uuid', nullable: true })
  firmaArchivoId: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
