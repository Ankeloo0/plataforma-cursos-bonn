import { defineConfig } from 'vitest/config';

// Pruebas unitarias: services y piezas comunes con dependencias simuladas, sin base de datos
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    setupFiles: ['./test/setup-unit.ts'],
  },
});
