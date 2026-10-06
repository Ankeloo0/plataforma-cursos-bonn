import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../constants/roles.js';

export const ROLES_KEY = 'roles';

// Roles que pueden usar una ruta. Toda ruta que no sea @Public() debe declararlos:
// RolesGuard rechaza las rutas sin @Roles para que un olvido no la deje abierta (technical-spec 4.7).
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
