import { SetMetadata } from '@nestjs/common';
import type { Permiso } from '../constants/permisos.js';

export const REQUIERE_PERMISO_KEY = 'requierePermiso';
export const PERMISO_NO_REQUERIDO_KEY = 'permisoNoRequerido';

// Un administrador necesita al menos uno de estos permisos. El superusuario siempre pasa.
export const RequierePermiso = (...permisos: Permiso[]) => SetMetadata(REQUIERE_PERMISO_KEY, permisos);

// Rutas que cualquier administrador usa sin permisos (su sesion, su perfil, selectores)
export const PermisoNoRequerido = () => SetMetadata(PERMISO_NO_REQUERIDO_KEY, true);
