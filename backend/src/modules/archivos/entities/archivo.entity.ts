import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Debe coincidir con el CHECK de archivos.estado (migracion 5)
export const ESTADOS_ARCHIVO = { LISTO: 'LISTO', PROCESANDO: 'PROCESANDO', ERROR: 'ERROR' } as const;
export type EstadoArchivo = (typeof ESTADOS_ARCHIVO)[keyof typeof ESTADOS_ARCHIVO];

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

  // PROCESANDO mientras FFmpeg comprime un video en segundo plano; las imagenes se guardan ya LISTO (P-11)
  @Column({ type: 'varchar', length: 12, default: ESTADOS_ARCHIVO.LISTO })
  estado: EstadoArchivo;

  @Column({ name: 'creado_por', type: 'uuid' })
  creadoPor: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
