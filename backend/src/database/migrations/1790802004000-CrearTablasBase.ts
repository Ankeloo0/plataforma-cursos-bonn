import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración 1 — tablas base: roles, empresas, usuarios y archivos (database-design.md §3.1–3.3 y §4.1).
 *
 * Escrita a mano en SQL porque TypeORM no genera por sí solo los CHECK, los índices únicos
 * sobre expresiones (lower(...)) ni los índices parciales.
 *
 * Referencias circulares: usuarios.foto_archivo_id → archivos y archivos.creado_por → usuarios,
 * además de la auditoría (empresas.creado_por → usuarios y usuarios.empresa_id → empresas).
 * Primero se crean las cuatro tablas y al final se agregan esas llaves foráneas con ALTER TABLE.
 */
export class CrearTablasBase1790802004000 implements MigrationInterface {
  name = 'CrearTablasBase1790802004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── roles (3.1): llave natural para poder escribir CHECK sobre usuarios.rol (D-05)
    await queryRunner.query(`
      CREATE TABLE roles (
        clave  varchar(20) PRIMARY KEY,
        nombre varchar(60) NOT NULL
      )
    `);

    // ── empresas (3.2): cada agencia del grupo (D-19)
    await queryRunner.query(`
      CREATE TABLE empresas (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre          varchar(120) NOT NULL,
        razon_social    varchar(200),
        activo          boolean      NOT NULL DEFAULT true,
        creado_en       timestamptz  NOT NULL DEFAULT now(),
        actualizado_en  timestamptz  NOT NULL DEFAULT now(),
        creado_por      uuid         NOT NULL,
        actualizado_por uuid
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_empresas_nombre_ci ON empresas (lower(nombre))`);

    // ── usuarios (3.3): cuenta y datos personales de los tres roles (D-18)
    await queryRunner.query(`
      CREATE TABLE usuarios (
        id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        rol                   varchar(20)  NOT NULL,
        empresa_id            uuid,
        username              varchar(50)  NOT NULL,
        password_hash         varchar(255) NOT NULL,
        nombres               varchar(80)  NOT NULL,
        apellido_paterno      varchar(60)  NOT NULL,
        apellido_materno      varchar(60),
        foto_archivo_id       uuid,
        debe_cambiar_password boolean      NOT NULL DEFAULT true,
        activo                boolean      NOT NULL DEFAULT true,
        version_token         integer      NOT NULL DEFAULT 0,
        ultimo_acceso_en      timestamptz,
        intentos_fallidos     smallint     NOT NULL DEFAULT 0,
        bloqueado_hasta       timestamptz,
        creado_en             timestamptz  NOT NULL DEFAULT now(),
        actualizado_en        timestamptz  NOT NULL DEFAULT now(),
        creado_por            uuid,
        actualizado_por       uuid,

        CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol) REFERENCES roles (clave) ON DELETE RESTRICT,
        CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT,

        -- El superusuario no pertenece a ninguna empresa; administradores y empleados, siempre a una.
        CONSTRAINT ck_usuarios_empresa_por_rol CHECK (
          (rol = 'SUPERUSUARIO' AND empresa_id IS NULL) OR (rol <> 'SUPERUSUARIO' AND empresa_id IS NOT NULL)
        ),
        -- Todos tienen creador, excepto el superusuario, que se crea en la instalación.
        CONSTRAINT ck_usuarios_creado_por CHECK (creado_por IS NOT NULL OR rol = 'SUPERUSUARIO'),

        -- Soporta las FK compuestas (usuario_id, empresa_id) de empleados (D-19).
        CONSTRAINT uq_usuarios_id_empresa UNIQUE (id, empresa_id)
      )
    `);
    // El usuario es único en todo el sistema, sin distinguir mayúsculas (RN-01.1).
    await queryRunner.query(`CREATE UNIQUE INDEX uq_usuarios_username_ci ON usuarios (lower(username))`);
    // Solo puede existir un superusuario (D-20).
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_usuarios_un_superusuario ON usuarios (rol) WHERE rol = 'SUPERUSUARIO'`,
    );
    await queryRunner.query(`CREATE INDEX ix_usuarios_empresa ON usuarios (empresa_id)`);

    // ── archivos (4.1): metadatos; el contenido vive en el storage (D-12)
    await queryRunner.query(`
      CREATE TABLE archivos (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        storage_key     varchar(500) NOT NULL,
        nombre_original varchar(255) NOT NULL,
        mime_type       varchar(100) NOT NULL,
        tamano_bytes    bigint       NOT NULL,
        creado_por      uuid         NOT NULL,
        creado_en       timestamptz  NOT NULL DEFAULT now(),

        CONSTRAINT uq_archivos_storage_key UNIQUE (storage_key),
        CONSTRAINT ck_archivos_tamano CHECK (tamano_bytes > 0)
      )
    `);

    // ── Llaves foráneas circulares y de auditoría, ahora que existen las cuatro tablas
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD CONSTRAINT fk_usuarios_foto FOREIGN KEY (foto_archivo_id) REFERENCES archivos (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_usuarios_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_usuarios_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE empresas
        ADD CONSTRAINT fk_empresas_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_empresas_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE archivos
        ADD CONSTRAINT fk_archivos_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Primero se quitan las FK circulares; después las tablas en orden inverso.
    await queryRunner.query(`ALTER TABLE usuarios DROP CONSTRAINT fk_usuarios_foto`);
    await queryRunner.query(`ALTER TABLE empresas DROP CONSTRAINT fk_empresas_creado_por, DROP CONSTRAINT fk_empresas_actualizado_por`);
    await queryRunner.query(`DROP TABLE archivos`);
    await queryRunner.query(`DROP TABLE usuarios`);
    await queryRunner.query(`DROP TABLE empresas`);
    await queryRunner.query(`DROP TABLE roles`);
  }
}
