// Costo de bcrypt para los hashes de contrasena (technical-spec 4.7, T-04).
export const BCRYPT_COSTO = 12;

// Politica de contrasenas (RN-01.5, propuesta vigente de P-20):
// minimo 8 caracteres, con al menos una letra y un numero.
export const PASSWORD_POLITICA = /^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?=.*\d).{8,}$/;
export const PASSWORD_POLITICA_MENSAJE =
  'La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número.';
