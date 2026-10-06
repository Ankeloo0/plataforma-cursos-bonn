import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { Permiso } from '../../../common/constants/permisos.js';

@Entity('usuarios_permisos')
export class UsuarioPermiso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 40 })
  permiso: Permiso;

  @Column({ name: 'creado_por', type: 'uuid' })
  creadoPor: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
