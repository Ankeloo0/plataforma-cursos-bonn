import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migracion 7: imagenes dentro de una pagina (material ARTICULO). Cada imagen es un archivo de una sola
// pagina; con esta tabla se sabe quien puede verla y que archivo borrar cuando se quita o se borra la pagina.
export class MaterialesImagenes1791700000000 implements MigrationInterface {
  name = 'MaterialesImagenes1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE materiales_imagenes (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        material_id uuid        NOT NULL,
        archivo_id  uuid        NOT NULL,
        creado_en   timestamptz NOT NULL DEFAULT now(),
        creado_por  uuid        NOT NULL,

        CONSTRAINT uq_materiales_imagenes_archivo UNIQUE (archivo_id),
        CONSTRAINT fk_materiales_imagenes_material FOREIGN KEY (material_id) REFERENCES materiales (id) ON DELETE CASCADE,
        CONSTRAINT fk_materiales_imagenes_archivo FOREIGN KEY (archivo_id) REFERENCES archivos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_materiales_imagenes_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_materiales_imagenes_material ON materiales_imagenes (material_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE materiales_imagenes`);
  }
}
