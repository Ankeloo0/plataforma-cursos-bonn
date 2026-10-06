import { defineConfig } from 'vitest/config';

// Pruebas e2e: la API completa contra una base PostgreSQL real, <DB_NAME>_test (test/e2e/entorno.ts).
// Requiere la base de Docker levantada. Ver infra/GUIA-DOCKER.md 3.7.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/e2e/global-setup.ts'],
    setupFiles: ['./test/e2e/setup-archivo.ts'],
    // Todos los archivos comparten la misma base: se ejecutan uno por uno
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
