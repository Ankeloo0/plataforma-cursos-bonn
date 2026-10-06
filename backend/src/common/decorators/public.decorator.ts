import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marca una ruta que no requiere sesion (p. ej. login y health).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
