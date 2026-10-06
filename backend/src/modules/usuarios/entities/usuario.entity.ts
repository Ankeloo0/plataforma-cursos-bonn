import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { Rol } from '../../../common/constants/roles.js';
import { ColumnasAuditoria } from '../../../common/entities/columnas-auditoria.entity.js';

// creado_por es null solo para el superusuario, que se crea en la instalacion
@Entity('usuarios')
export class Usuario extends ColumnasAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  rol: Rol;

  // Solo el empleado tiene sucursal; el alcance del administrador esta en administradores_sucursales
  @Column({ name: 'sucursal_id', type: 'uuid', nullable: true })
  sucursalId: string | null;

  // Solo administrador y superusuario; el empleado entra con su empresa y su numero de empleado (D-34)
  @Column({ type: 'varchar', length: 50, nullable: true })
  username: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 80 })
  nombres: string;

  @Column({ name: 'apellido_paterno', type: 'varchar', length: 60 })
  apellidoPaterno: string;

  @Column({ name: 'apellido_materno', type: 'varchar', length: 60, nullable: true })
  apellidoMaterno: string | null;

  @Column({ name: 'foto_archivo_id', type: 'uuid', nullable: true })
  fotoArchivoId: string | null;

  @Column({ name: 'debe_cambiar_password', type: 'boolean', default: true })
  debeCambiarPassword: boolean;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'version_token', type: 'integer', default: 0 })
  versionToken: number;

  @Column({ name: 'ultimo_acceso_en', type: 'timestamptz', nullable: true })
  ultimoAccesoEn: Date | null;

  @Column({ name: 'intentos_fallidos', type: 'smallint', default: 0 })
  intentosFallidos: number;

  @Column({ name: 'bloqueado_hasta', type: 'timestamptz', nullable: true })
  bloqueadoHasta: Date | null;
}
