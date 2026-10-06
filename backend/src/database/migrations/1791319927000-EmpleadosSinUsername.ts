import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migracion 3 (database-design D-34): el empleado inicia sesion con su empresa y su numero de empleado,
// asi que no tiene usuario. El administrador y el superusuario lo conservan.
export class EmpleadosSinUsername1791319927000 implements MigrationInterface {
  name = 'EmpleadosSinUsername1791319927000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Aun no hay alta de empleados: si existe alguno, se avisa en lugar de borrar su usuario
    const [{ empleados }] = await queryRunner.query(
      `SELECT count(*)::int AS empleados FROM usuarios WHERE rol = 'EMPLEADO' AND username IS NOT NULL`,
    );
    if (empleados > 0) {
      throw new Error(
        `Hay ${empleados} empleados con nombre de usuario. Elimínalos antes de aplicar la migración 3: el empleado entra con su número de empleado.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE usuarios
        ALTER COLUMN username DROP NOT NULL,
        ADD CONSTRAINT ck_usuarios_username_por_rol CHECK ((rol = 'EMPLEADO') = (username IS NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ empleados }] = await queryRunner.query(`SELECT count(*)::int AS empleados FROM usuarios WHERE rol = 'EMPLEADO'`);
    if (empleados > 0) {
      throw new Error(`Hay ${empleados} empleados sin nombre de usuario. Elimínalos antes de revertir la migración 3.`);
    }

    await queryRunner.query(`
      ALTER TABLE usuarios
        DROP CONSTRAINT ck_usuarios_username_por_rol,
        ALTER COLUMN username SET NOT NULL
    `);
  }
}
