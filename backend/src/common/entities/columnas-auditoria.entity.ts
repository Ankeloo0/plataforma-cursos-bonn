import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Columnas de auditoria de las tablas marcadas con (A) en database-design.md 1.1.
//
// Las entidades auditables la extienden. El service asigna `creadoPor` y `actualizadoPor`
// de forma explicita con el usuario de la sesion (@UsuarioActual), nunca el cliente (T-20).
export abstract class ColumnasAuditoria {
  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;

  @Column({ name: 'creado_por', type: 'uuid' })
  creadoPor: string;

  // `null` = el registro nunca se ha modificado.
  @Column({ name: 'actualizado_por', type: 'uuid', nullable: true })
  actualizadoPor: string | null;
}
