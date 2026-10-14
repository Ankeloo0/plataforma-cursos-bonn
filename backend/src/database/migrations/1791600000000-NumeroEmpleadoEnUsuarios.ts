import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migracion 6: los tres roles entran con empresa y numero de empleado, asi que ambos datos pasan
// de empleados a usuarios y se elimina username. El numero sigue siendo unico dentro de la empresa,
// ahora entre todas las cuentas. Administradores y superusuario que ya existian quedan sin numero
// y no pueden entrar hasta tenerlo: al administrador se lo asigna el superusuario al editarlo,
// y al superusuario, el seed.
export class NumeroEmpleadoEnUsuarios1791600000000 implements MigrationInterface {
  name = 'NumeroEmpleadoEnUsuarios1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN empresa_id uuid,
        ADD COLUMN numero_empleado varchar(20),
        ADD CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      UPDATE usuarios u
         SET empresa_id = em.empresa_id, numero_empleado = em.numero_empleado
        FROM empleados em
       WHERE em.usuario_id = u.id
    `);
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD CONSTRAINT ck_usuarios_numero_con_empresa CHECK ((empresa_id IS NULL) = (numero_empleado IS NULL)),
        ADD CONSTRAINT ck_usuarios_numero_empleado CHECK (rol <> 'EMPLEADO' OR numero_empleado IS NOT NULL)
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_usuarios_empresa_numero_ci ON usuarios (empresa_id, lower(numero_empleado))`,
    );

    await queryRunner.query(`DROP INDEX uq_empleados_empresa_numero_ci`);
    await queryRunner.query(`ALTER TABLE empleados DROP COLUMN empresa_id, DROP COLUMN numero_empleado`);

    await queryRunner.query(`ALTER TABLE usuarios DROP CONSTRAINT ck_usuarios_username_por_rol`);
    await queryRunner.query(`DROP INDEX uq_usuarios_username_ci`);
    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN username`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    //el usuario anterior no se puede recuperar: se usa el id y el superusuario lo cambia despues
    await queryRunner.query(`ALTER TABLE usuarios ADD COLUMN username varchar(50)`);
    await queryRunner.query(`UPDATE usuarios SET username = 'u-' || id::text WHERE rol <> 'EMPLEADO'`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_usuarios_username_ci ON usuarios (lower(username))`);
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD CONSTRAINT ck_usuarios_username_por_rol CHECK ((rol = 'EMPLEADO') = (username IS NULL))
    `);

    await queryRunner.query(`
      ALTER TABLE empleados
        ADD COLUMN empresa_id uuid,
        ADD COLUMN numero_empleado varchar(20)
    `);
    await queryRunner.query(`
      UPDATE empleados em
         SET empresa_id = u.empresa_id, numero_empleado = u.numero_empleado
        FROM usuarios u
       WHERE u.id = em.usuario_id
    `);
    await queryRunner.query(`
      ALTER TABLE empleados
        ALTER COLUMN empresa_id SET NOT NULL,
        ALTER COLUMN numero_empleado SET NOT NULL,
        ADD CONSTRAINT fk_empleados_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_empleados_empresa_numero_ci ON empleados (empresa_id, lower(numero_empleado))`,
    );

    await queryRunner.query(`DROP INDEX uq_usuarios_empresa_numero_ci`);
    await queryRunner.query(`
      ALTER TABLE usuarios
        DROP CONSTRAINT ck_usuarios_numero_empleado,
        DROP CONSTRAINT ck_usuarios_numero_con_empresa,
        DROP CONSTRAINT fk_usuarios_empresa,
        DROP COLUMN numero_empleado,
        DROP COLUMN empresa_id
    `);
  }
}
