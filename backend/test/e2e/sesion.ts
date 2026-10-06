import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PASSWORD_PRUEBA } from './fabricas.js';

// Inicia sesion como administrador o superusuario y devuelve la cookie lista para .set('Cookie', cookie)
export async function iniciarSesion(
  app: INestApplication,
  username: string | null,
  password = PASSWORD_PRUEBA,
): Promise<string> {
  if (!username) throw new Error('El empleado no tiene usuario: inicia sesion por /auth/login-empleado (D-34)');
  const respuesta = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ username, password })
    .expect(200);
  return cookieDe(respuesta.headers['set-cookie']);
}

export function cookieDe(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sesion = cookies.find((c) => c.startsWith('bonn_sesion='));
  if (!sesion) throw new Error('La respuesta no trae la cookie de sesion');
  return sesion.split(';')[0];
}
