import type { MigrationInterface, QueryRunner } from 'typeorm';

// Migracion 5 (database-design 4.1 a 4.4): cursos sin dueno (D-29), temas y materiales ordenados,
// y el estado de un archivo mientras FFmpeg comprime un video en segundo plano (D-35, P-11).
// La duracion del curso la calcula el sistema con sus videos (D-36), y los materiales ya admiten
// articulos escritos en la plataforma aunque todavia no se usen (D-37).
// Es la migracion completa de I3: las partes I3.2 a I3.4 no agregan otra.
export class CursosTemasMateriales1791500000000 implements MigrationInterface {
  name = 'CursosTemasMateriales1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Las fotos y logotipos que ya existen quedan en LISTO por el valor por defecto
    await queryRunner.query(`
      ALTER TABLE archivos
        ADD COLUMN estado varchar(12) NOT NULL DEFAULT 'LISTO',
        ADD CONSTRAINT ck_archivos_estado CHECK (estado IN ('LISTO', 'PROCESANDO', 'ERROR'))
    `);

    await queryRunner.query(`
      CREATE TABLE cursos (
        id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo              varchar(150)  NOT NULL,
        descripcion         text,
        imagen_archivo_id   uuid,
        duracion_horas      numeric(6,2)  NOT NULL DEFAULT 0,
        es_obligatorio      boolean       NOT NULL DEFAULT false,
        fecha_limite        date,
        calificacion_minima numeric(5,2)  NOT NULL,
        estado              varchar(20)   NOT NULL DEFAULT 'BORRADOR',
        publicado_en        timestamptz,
        creado_en           timestamptz   NOT NULL DEFAULT now(),
        actualizado_en      timestamptz   NOT NULL DEFAULT now(),
        creado_por          uuid          NOT NULL,
        actualizado_por     uuid,

        CONSTRAINT fk_cursos_imagen FOREIGN KEY (imagen_archivo_id) REFERENCES archivos (id) ON DELETE SET NULL,
        CONSTRAINT fk_cursos_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_cursos_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        -- 0 mientras no tenga videos: la calcula el sistema, no se captura (D-36)
        CONSTRAINT ck_cursos_duracion CHECK (duracion_horas >= 0),
        CONSTRAINT ck_cursos_calificacion CHECK (calificacion_minima BETWEEN 0 AND 100),
        CONSTRAINT ck_cursos_estado CHECK (estado IN ('BORRADOR', 'PUBLICADO', 'ARCHIVADO')),
        CONSTRAINT ck_cursos_publicado_en CHECK (estado = 'BORRADOR' OR publicado_en IS NOT NULL)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_cursos_estado ON cursos (estado)`);
    await queryRunner.query(`CREATE INDEX ix_cursos_fecha_limite ON cursos (fecha_limite)`);

    await queryRunner.query(`
      CREATE TABLE temas (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        curso_id        uuid         NOT NULL,
        titulo          varchar(150) NOT NULL,
        descripcion     text,
        orden           smallint     NOT NULL,
        activo          boolean      NOT NULL DEFAULT true,
        creado_en       timestamptz  NOT NULL DEFAULT now(),
        actualizado_en  timestamptz  NOT NULL DEFAULT now(),
        creado_por      uuid         NOT NULL,
        actualizado_por uuid,

        CONSTRAINT fk_temas_curso FOREIGN KEY (curso_id) REFERENCES cursos (id) ON DELETE CASCADE,
        CONSTRAINT fk_temas_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_temas_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT ck_temas_orden CHECK (orden > 0),
        CONSTRAINT uq_temas_curso_orden UNIQUE (curso_id, orden)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE materiales (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        tema_id         uuid         NOT NULL,
        titulo          varchar(150) NOT NULL,
        descripcion     text,
        tipo            varchar(20)  NOT NULL,
        orden           smallint     NOT NULL,
        activo          boolean      NOT NULL DEFAULT true,
        archivo_id      uuid,
        url_externa     varchar(500),
        contenido       text,
        texto_extraido  text,
        duracion_segundos integer    NOT NULL DEFAULT 0,
        creado_en       timestamptz  NOT NULL DEFAULT now(),
        actualizado_en  timestamptz  NOT NULL DEFAULT now(),
        creado_por      uuid         NOT NULL,
        actualizado_por uuid,

        CONSTRAINT fk_materiales_tema FOREIGN KEY (tema_id) REFERENCES temas (id) ON DELETE CASCADE,
        CONSTRAINT fk_materiales_archivo FOREIGN KEY (archivo_id) REFERENCES archivos (id) ON DELETE RESTRICT,
        CONSTRAINT fk_materiales_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT fk_materiales_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id) ON DELETE RESTRICT,
        CONSTRAINT ck_materiales_tipo CHECK (tipo IN ('VIDEO', 'PDF', 'IMAGEN', 'DOCUMENTO', 'ENLACE', 'ARTICULO')),
        CONSTRAINT ck_materiales_orden CHECK (orden > 0),
        CONSTRAINT ck_materiales_duracion CHECK (duracion_segundos >= 0),
        CONSTRAINT uq_materiales_tema_orden UNIQUE (tema_id, orden),
        -- Exactamente una fuente: el enlace usa url_externa; el articulo, su contenido; los demas, un archivo
        CONSTRAINT ck_materiales_fuente CHECK (
          (tipo = 'ENLACE' AND url_externa IS NOT NULL AND archivo_id IS NULL AND contenido IS NULL)
          OR (tipo = 'ARTICULO' AND contenido IS NOT NULL AND archivo_id IS NULL AND url_externa IS NULL)
          OR (tipo IN ('VIDEO', 'PDF', 'IMAGEN', 'DOCUMENTO') AND archivo_id IS NOT NULL AND url_externa IS NULL AND contenido IS NULL)
        )
      )
    `);
    // La consulta del asistente debe usar exactamente esta expresion para que se use el indice (database-design 4.4)
    await queryRunner.query(`
      CREATE INDEX ix_materiales_busqueda ON materiales USING GIN (
        to_tsvector('spanish', titulo || ' ' || coalesce(descripcion, '') || ' ' || coalesce(contenido, '') || ' ' || coalesce(texto_extraido, ''))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE materiales`);
    await queryRunner.query(`DROP TABLE temas`);
    await queryRunner.query(`DROP TABLE cursos`);
    await queryRunner.query(`ALTER TABLE archivos DROP CONSTRAINT ck_archivos_estado, DROP COLUMN estado`);
  }
}
