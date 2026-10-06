import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Prepara las variables de entorno de las pruebas e2e.
//
// - Fuera de Docker lee backend/.env; dentro del contenedor ya vienen en el entorno.
// - Usa SIEMPRE una base aparte, `<DB_NAME>_test`, para no tocar los datos de desarrollo.
//
// Se llama en el globalSetup y en cada archivo de prueba (setupFiles); es idempotente.
export function cargarEntornoE2e(): void {
  if (process.env.IGNORE_ENV_FILE !== 'true' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const base = process.env.DB_NAME ?? 'capacitacion_bonn';
  process.env.DB_NAME = base.endsWith('_test') ? base : `${base}_test`;
  process.env.NODE_ENV = 'test';
  // Los archivos de prueba no se mezclan con los de desarrollo
  process.env.STORAGE_LOCAL_PATH = path.join(tmpdir(), 'bonn-e2e-storage');
  // Las pruebas inician muchas sesiones seguidas desde la misma IP
  process.env.LOGIN_LIMITE_POR_MINUTO = '1000';
  // La prueba de Swagger revisa que no se publique si no se pide, sin importar el .env local
  process.env.SWAGGER_ENABLED = 'false';
}
