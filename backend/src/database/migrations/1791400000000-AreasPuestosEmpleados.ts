import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migracion 4 (database-design 3.6, 3.7 y 3.10): catalogo unico de areas y puestos (D-25) y empleados.
// empleados.empresa_id permite que la base garantice el numero de empleado unico por empresa,
// que es el dato con el que el empleado inicia sesion (D-34).
export class AreasPuestosEmpleados1791400000000 implements MigrationInterface {
  name = 'AreasPuestosEmpleados1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE areas (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre          varchar(100) NOT NULL,
        descripcion     varchar(500),
        activo          boolean      NOT NULL DEFAULT true,
        creado_en       timestamptz  NOT NULL DEFAULT now(),
        actualizado_en  timestamptz  NOT NULL DEFAULT now(),
        creado_por      uuid         NOT NULL,
        actualizado_por uuid,

        CONSTRAINT fk_areas_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_areas_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_areas_nombre_ci ON areas (lower(nombre))`);

    await queryRunner.query(`
      CREATE TABLE puestos (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        area_id         uuid         NOT NULL,
        nombre          varchar(100) NOT NULL,
        descripcion     varchar(500),
        activo          boolean      NOT NULL DEFAULT true,
        creado_en       timestamptz  NOT NULL DEFAULT now(),
        actualizado_en  timestamptz  NOT NULL DEFAULT now(),
        creado_por      uuid         NOT NULL,
        actualizado_por uuid,

        CONSTRAINT fk_puestos_area FOREIGN KEY (area_id) REFERENCES areas (id) ON DELETE RESTRICT,
        CONSTRAINT fk_puestos_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_puestos_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_puestos_area_nombre_ci ON puestos (area_id, lower(nombre))`);

    await queryRunner.query(`
      CREATE TABLE empleados (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id      uuid        NOT NULL,
        empresa_id      uuid        NOT NULL,
        numero_empleado varchar(20) NOT NULL,
        puesto_id       uuid        NOT NULL,
        fecha_ingreso   date        NOT NULL,
        creado_en       timestamptz NOT NULL DEFAULT now(),
        actualizado_en  timestamptz NOT NULL DEFAULT now(),
        creado_por      uuid        NOT NULL,
        actualizado_por uuid,

        CONSTRAINT uq_empleados_usuario UNIQUE (usuario_id),
        CONSTRAINT fk_empleados_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_empleados_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT,
        CONSTRAINT fk_empleados_puesto FOREIGN KEY (puesto_id) REFERENCES puestos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_empleados_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_empleados_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_empleados_empresa_numero_ci ON empleados (empresa_id, lower(numero_empleado))`,
    );
    await queryRunner.query(`CREATE INDEX ix_empleados_puesto ON empleados (puesto_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE empleados`);
    await queryRunner.query(`DROP TABLE puestos`);
    await queryRunner.query(`DROP TABLE areas`);
  }
}
