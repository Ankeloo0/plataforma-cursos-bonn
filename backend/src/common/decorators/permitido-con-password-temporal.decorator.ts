import { SetMetadata } from '@nestjs/common';

export const PERMITIDO_CON_PASSWORD_TEMPORAL_KEY = 'permitidoConPasswordTemporal';

// Rutas que un usuario con contrasena temporal puede usar antes de cambiarla (me, cambiar-password)
export const PermitidoConPasswordTemporal = () => SetMetadata(PERMITIDO_CON_PASSWORD_TEMPORAL_KEY, true);
