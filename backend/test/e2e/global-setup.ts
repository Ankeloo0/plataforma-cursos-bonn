import { prepararBasePruebas } from './base-de-datos.js';
import { cargarEntornoE2e } from './entorno.js';

// Se ejecuta una vez antes de todas las pruebas e2e.
export default async function setup(): Promise<void> {
  cargarEntornoE2e();
  await prepararBasePruebas();
}
