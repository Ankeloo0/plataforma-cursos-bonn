import type { Uso } from '../types/catalogo.types';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// "12 empleados en 3 sucursales de 2 empresas" (RN-02.6)
export function textoUso(uso: Uso): string {
  if (uso.empleados === 0) return 'Ningún empleado activo';
  return `${plural(uso.empleados, 'empleado', 'empleados')} en ${plural(uso.sucursales, 'sucursal', 'sucursales')} de ${plural(uso.empresas, 'empresa', 'empresas')}`;
}
