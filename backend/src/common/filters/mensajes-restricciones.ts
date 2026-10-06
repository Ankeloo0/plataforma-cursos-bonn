// Mensaje propio para cada restriccion de la base que un formulario puede violar.
// La llave es el nombre de la restriccion o del indice en la migracion.
// Las que no esten aqui usan el mensaje generico de AllExceptionsFilter.
export const MENSAJES_RESTRICCIONES: Record<string, { code: string; message: string }> = {
  // Migracion 1: roles, empresas, usuarios, archivos
  uq_empresas_nombre_ci: {
    code: 'EMPRESA_NOMBRE_DUPLICADO',
    message: 'Ya existe una empresa con ese nombre.',
  },
  uq_usuarios_username_ci: {
    code: 'USUARIO_USERNAME_DUPLICADO',
    message: 'Ese nombre de usuario ya está en uso. Elige otro.',
  },
  uq_usuarios_un_superusuario: {
    code: 'SUPERUSUARIO_UNICO',
    message: 'Solo puede existir un superusuario.',
  },

  // Migracion 2: marcas, sucursales y permisos
  uq_empresas_prefijo_folio: {
    code: 'EMPRESA_PREFIJO_DUPLICADO',
    message: 'Otra empresa ya usa ese prefijo de folio. Elige otro.',
  },
  uq_marcas_nombre_ci: {
    code: 'MARCA_NOMBRE_DUPLICADO',
    message: 'Ya existe una marca con ese nombre.',
  },
  uq_sucursales_empresa_nombre_ci: {
    code: 'SUCURSAL_NOMBRE_DUPLICADO',
    message: 'Esta empresa ya tiene una sucursal con ese nombre.',
  },
};
