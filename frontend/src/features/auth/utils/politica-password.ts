// Misma politica que valida la API (backend/src/common/constants/seguridad.ts, P-20)
export const REGLAS_PASSWORD = [
  { texto: 'Al menos 8 caracteres', cumple: (p: string) => p.length >= 8 },
  { texto: 'Al menos una letra', cumple: (p: string) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(p) },
  { texto: 'Al menos un número', cumple: (p: string) => /\d/.test(p) },
];

export function cumplePolitica(password: string): boolean {
  return REGLAS_PASSWORD.every((regla) => regla.cumple(password));
}
