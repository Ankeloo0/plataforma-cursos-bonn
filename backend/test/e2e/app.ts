import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configurarApp } from '../../src/app.setup.js';

export interface AppE2e {
  app: INestApplication;
  dataSource: DataSource;
}

// Levanta la aplicacion completa, con la misma configuracion HTTP que produccion (configurarApp),
// conectada a la base de pruebas. `controllers` permite agregar controladores solo para una prueba.
export async function crearAppE2e(controllers: Type[] = []): Promise<AppE2e> {
  const modulo = await Test.createTestingModule({ imports: [AppModule], controllers }).compile();
  const app = modulo.createNestApplication({ logger: false });
  configurarApp(app);
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}
