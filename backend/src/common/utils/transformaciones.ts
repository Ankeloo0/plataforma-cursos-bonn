import { Transform } from 'class-transformer';

export const Recortar = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Un texto opcional vacio se guarda como null
export const RecortarONulo = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const recortado = value.trim();
    return recortado === '' ? null : recortado;
  });

// Los filtros de la URL llegan como texto: "true" / "false"
export const ABooleano = () =>
  Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));
