import 'reflect-metadata';
import { cargarEntornoE2e } from './entorno.js';

// Cada archivo de prueba corre en su propio proceso: se vuelve a preparar el entorno.
cargarEntornoE2e();
