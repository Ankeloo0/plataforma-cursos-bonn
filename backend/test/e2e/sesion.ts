import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PASSWORD_PRUEBA } from './fabricas.js';

// Inicia sesion con empresa, numero y contrasena (los tres roles) y devuelve la cookie lista para .set('Cookie', cookie)
export async function iniciarSesion(
  app: INestApplication,
  cuenta: { empresaId: string; numeroEmpleado: string },
  password = PASSWORD_PRUEBA,
): Promise<string> {
  const respuesta = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ empresaId: cuenta.empresaId, numeroEmpleado: cuenta.numeroEmpleado, password })
    .expect(200);
  return cookieDe(respuesta.headers['set-cookie']);
}

export function cookieDe(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sesion = cookies.find((c) => c.startsWith('bonn_sesion='));
  if (!sesion) throw new Error('La respuesta no trae la cookie de sesion');
  return sesion.split(';')[0];
}
