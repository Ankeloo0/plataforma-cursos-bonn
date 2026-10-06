/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Donde esta la API durante el desarrollo:
// - dentro de Docker: http://api:3000 (lo define docker-compose.dev.yml)
// - fuera de Docker: http://localhost:3200 (el puerto publicado de la API)
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3200';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5200,
    strictPort: true,
    // Redirigir /api imita al nginx de produccion: mismo origen, sin CORS, cookie de sesion funcional.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
    // En Docker sobre macOS/Windows, si la recarga automatica no detecta cambios, activa el sondeo.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
