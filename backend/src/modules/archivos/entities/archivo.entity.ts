import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('archivos')
export class Archivo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey: string;

  @Column({ name: 'nombre_original', type: 'varchar', length: 255 })
  nombreOriginal: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  // bigint llega como texto desde pg
  @Column({ name: 'tamano_bytes', type: 'bigint' })
  tamanoBytes: string;

  @Column({ name: 'creado_por', type: 'uuid' })
  creadoPor: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
