// Fondos de las iniciales. Todos tienen contraste >= 4.5:1 con texto blanco (WCAG AA para texto pequeno).
// design-reference.md 8.5 pedia los 5 colores de serie, pero --serie-2, 4 y 5 no llegan a 4.5:1.
export const FONDOS_INICIALES = [
  'var(--serie-1)',
  'var(--serie-3)',
  'var(--color-marca)',
  'var(--color-vino)',
  'var(--gris-600)',
];

export function iniciales(nombres: string, apellidoPaterno?: string): string {
  const primera = (texto?: string) => texto?.trim().charAt(0).toLocaleUpperCase('es-MX') ?? '';
  return primera(nombres) + primera(apellidoPaterno);
}

// Indice estable a partir del id: la misma persona siempre tiene el mismo color.
export function indiceDeColor(id: string): number {
  let suma = 0;
  for (const caracter of id) suma = (suma * 31 + caracter.charCodeAt(0)) >>> 0;
  return suma % FONDOS_INICIALES.length;
}
