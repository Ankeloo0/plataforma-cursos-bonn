import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migracion 2 (database-design 15.8): marcas, sucursales, permisos y sucursales de cada administrador.
// usuarios.empresa_id se sustituye por sucursal_id, que solo tienen los empleados (D-28).
export class MarcasSucursalesPermisos1790964000000 implements MigrationInterface {
  name = 'MarcasSucursalesPermisos1790964000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Antes de esta migracion no habia alta de empleados: si existe alguno, no hay forma de saber su sucursal
    const [{ empleados }] = await queryRunner.query(`SELECT count(*)::int AS empleados FROM usuarios WHERE rol = 'EMPLEADO'`);
    if (empleados > 0) {
      throw new Error(
        `Hay ${empleados} usuarios con rol EMPLEADO sin sucursal. Asígnalos o elimínalos antes de aplicar la migración 2.`,
      );
    }

    await queryRunner.query(`
      CREATE TABLE marcas (
        id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre                  varchar(80) NOT NULL,
        logo_archivo_id         uuid,
        instrucciones_asistente text,
        activo                  boolean     NOT NULL DEFAULT true,
        creado_en               timestamptz NOT NULL DEFAULT now(),
        actualizado_en          timestamptz NOT NULL DEFAULT now(),
        creado_por              uuid        NOT NULL,
        actualizado_por         uuid,

        CONSTRAINT fk_marcas_logo FOREIGN KEY (logo_archivo_id) REFERENCES archivos (id) ON DELETE SET NULL,
        CONSTRAINT fk_marcas_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_marcas_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_marcas_nombre_ci ON marcas (lower(nombre))`);

    await queryRunner.query(`
      CREATE TABLE sucursales (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        empresa_id      uuid         NOT NULL,
        marca_id        uuid         NOT NULL,
        nombre          varchar(120) NOT NULL,
        direccion       varchar(250),
        activo          boolean      NOT NULL DEFAULT true,
        creado_en       timestamptz  NOT NULL DEFAULT now(),
        actualizado_en  timestamptz  NOT NULL DEFAULT now(),
        creado_por      uuid         NOT NULL,
        actualizado_por uuid,

        CONSTRAINT fk_sucursales_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT,
        CONSTRAINT fk_sucursales_marca FOREIGN KEY (marca_id) REFERENCES marcas (id) ON DELETE RESTRICT,
        CONSTRAINT fk_sucursales_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_sucursales_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_sucursales_empresa_nombre_ci ON sucursales (empresa_id, lower(nombre))`,
    );
    await queryRunner.query(`CREATE INDEX ix_sucursales_marca ON sucursales (marca_id)`);

    await queryRunner.query(`
      ALTER TABLE empresas
        ADD COLUMN prefijo_folio    varchar(6),
        ADD COLUMN logo_archivo_id  uuid,
        ADD COLUMN firmante_nombre  varchar(150),
        ADD COLUMN firmante_cargo   varchar(150),
        ADD COLUMN firma_archivo_id uuid
    `);
    // Prefijo provisional para las empresas existentes (E001, E002...); el superusuario lo cambia despues
    await queryRunner.query(`
      UPDATE empresas e SET prefijo_folio = 'E' || lpad(n.fila::text, 3, '0')
      FROM (SELECT id, row_number() OVER (ORDER BY creado_en, id) AS fila FROM empresas) n
      WHERE n.id = e.id
    `);
    await queryRunner.query(`
      ALTER TABLE empresas
        ALTER COLUMN prefijo_folio SET NOT NULL,
        ADD CONSTRAINT ck_empresas_prefijo_folio CHECK (prefijo_folio ~ '^[A-Z0-9]{2,6}$'),
        ADD CONSTRAINT uq_empresas_prefijo_folio UNIQUE (prefijo_folio),
        ADD CONSTRAINT fk_empresas_logo FOREIGN KEY (logo_archivo_id) REFERENCES archivos (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_empresas_firma FOREIGN KEY (firma_archivo_id) REFERENCES archivos (id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE usuarios
        DROP CONSTRAINT ck_usuarios_empresa_por_rol,
        DROP CONSTRAINT uq_usuarios_id_empresa,
        DROP CONSTRAINT fk_usuarios_empresa
    `);
    await queryRunner.query(`DROP INDEX ix_usuarios_empresa`);
    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN empresa_id`);
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN sucursal_id uuid,
        ADD CONSTRAINT fk_usuarios_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE RESTRICT,
        ADD CONSTRAINT ck_usuarios_sucursal_por_rol CHECK ((rol = 'EMPLEADO') = (sucursal_id IS NOT NULL))
    `);
    await queryRunner.query(`CREATE INDEX ix_usuarios_sucursal ON usuarios (sucursal_id)`);

    await queryRunner.query(`
      CREATE TABLE usuarios_permisos (
        id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id uuid        NOT NULL,
        permiso    varchar(40) NOT NULL,
        creado_por uuid        NOT NULL,
        creado_en  timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT fk_usuarios_permisos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
        CONSTRAINT fk_usuarios_permisos_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT uq_usuarios_permisos UNIQUE (usuario_id, permiso),
        CONSTRAINT ck_usuarios_permisos_permiso CHECK (permiso IN (
          'MARCAS_GESTIONAR', 'CATALOGO_GESTIONAR', 'EMPLEADOS_VER', 'EMPLEADOS_GESTIONAR',
          'EMPLEADOS_RESTABLECER_PASSWORD', 'CURSOS_GESTIONAR', 'CURSOS_PUBLICAR', 'CURSOS_ASIGNAR',
          'INTENTOS_OTORGAR', 'CERTIFICADOS_VER', 'REPORTES_VER', 'ASISTENTE_USAR'
        ))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE administradores_sucursales (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id  uuid        NOT NULL,
        sucursal_id uuid        NOT NULL,
        creado_por  uuid        NOT NULL,
        creado_en   timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT fk_administradores_sucursales_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
        CONSTRAINT fk_administradores_sucursales_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE RESTRICT,
        CONSTRAINT fk_administradores_sucursales_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT uq_administradores_sucursales UNIQUE (usuario_id, sucursal_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_administradores_sucursales_sucursal ON administradores_sucursales (sucursal_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE administradores_sucursales`);
    await queryRunner.query(`DROP TABLE usuarios_permisos`);

    await queryRunner.query(`DROP INDEX ix_usuarios_sucursal`);
    await queryRunner.query(`ALTER TABLE usuarios DROP CONSTRAINT ck_usuarios_sucursal_por_rol, DROP COLUMN sucursal_id`);
    // Los administradores existentes ya no tienen empresa: el CHECK vuelve como NOT VALID para no rechazarlos
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN empresa_id uuid,
        ADD CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT,
        ADD CONSTRAINT uq_usuarios_id_empresa UNIQUE (id, empresa_id),
        ADD CONSTRAINT ck_usuarios_empresa_por_rol CHECK (
          (rol = 'SUPERUSUARIO' AND empresa_id IS NULL) OR (rol <> 'SUPERUSUARIO' AND empresa_id IS NOT NULL)
        ) NOT VALID
    `);
    await queryRunner.query(`CREATE INDEX ix_usuarios_empresa ON usuarios (empresa_id)`);

    await queryRunner.query(`
      ALTER TABLE empresas
        DROP CONSTRAINT fk_empresas_firma,
        DROP CONSTRAINT fk_empresas_logo,
        DROP CONSTRAINT uq_empresas_prefijo_folio,
        DROP CONSTRAINT ck_empresas_prefijo_folio,
        DROP COLUMN firma_archivo_id,
        DROP COLUMN firmante_cargo,
        DROP COLUMN firmante_nombre,
        DROP COLUMN logo_archivo_id,
        DROP COLUMN prefijo_folio
    `);

    await queryRunner.query(`DROP TABLE sucursales`);
    await queryRunner.query(`DROP TABLE marcas`);
  }
}
