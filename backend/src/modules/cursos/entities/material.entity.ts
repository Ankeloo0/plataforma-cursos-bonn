import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';
import { Archivo } from '../../archivos/entities/archivo.entity.js';

// Debe coincidir con el CHECK de materiales.tipo (migracion 5)
export const TIPOS_MATERIAL = {
  VIDEO: 'VIDEO',
  PDF: 'PDF',
  IMAGEN: 'IMAGEN',
  DOCUMENTO: 'DOCUMENTO',
  ENLACE: 'ENLACE',
  ARTICULO: 'ARTICULO',
} as const;
export type TipoMaterial = (typeof TIPOS_MATERIAL)[keyof typeof TIPOS_MATERIAL];

// Una sola fuente por material (ck_materiales_fuente): archivo, enlace o contenido del articulo
@Entity('materiales')
export class Material extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tema_id', type: 'uuid' })
  temaId: string;

  @Column({ type: 'varchar', length: 150 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoMaterial;

  @Column({ type: 'smallint' })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'archivo_id', type: 'uuid', nullable: true })
  archivoId: string | null;

  @ManyToOne(() => Archivo, { nullable: true })
  @JoinColumn({ name: 'archivo_id' })
  archivo?: Archivo | null;

  @Column({ name: 'url_externa', type: 'varchar', length: 500, nullable: true })
  urlExterna: string | null;

  @Column({ type: 'text', nullable: true })
  contenido: string | null;

  // Texto de un PDF para el asistente (D-33); no se envia al cliente
  @Column({ name: 'texto_extraido', type: 'text', nullable: true })
  textoExtraido: string | null;

  // Video: la mide ffprobe (D-36). Los demas tipos de I3.2 valen 0.
  @Column({ name: 'duracion_segundos', type: 'integer', default: 0 })
  duracionSegundos: number;
}
