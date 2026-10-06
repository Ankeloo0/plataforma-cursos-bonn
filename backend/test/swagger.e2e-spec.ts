import request from 'supertest';
import { crearAppE2e, type AppE2e } from './e2e/app.js';

// En las pruebas SWAGGER_ENABLED=false (test/e2e/entorno.ts), igual que en produccion
describe('Documentación de la API (Swagger)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await crearAppE2e();
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('no se publica si SWAGGER_ENABLED no está activo', async () => {
    await request(e2e.app.getHttpServer()).get('/api/docs').expect(404);
    await request(e2e.app.getHttpServer()).get('/api/docs-json').expect(404);
  });
});
