import type { Administrador } from '../types/administradores.types';

export const nombreAdministrador = (a: Administrador) => [a.nombres, a.apellidoPaterno, a.apellidoMaterno].filter(Boolean).join(' ');
