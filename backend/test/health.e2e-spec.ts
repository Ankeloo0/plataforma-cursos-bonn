import request from 'supertest';
import { crearAppE2e, type AppE2e } from './e2e/app.js';

describe('GET /api/v1/health', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await crearAppE2e();
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('responde ok sin sesión, porque es una ruta pública', async () => {
    const respuesta = await request(e2e.app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(respuesta.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('responde las rutas inexistentes con el formato de error común', async () => {
    const respuesta = await request(e2e.app.getHttpServer()).get('/api/v1/no-existe').expect(404);
    expect(respuesta.body).toMatchObject({ statusCode: 404, error: 'NOT_FOUND' });
  });
});
