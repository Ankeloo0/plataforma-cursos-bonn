// Catalogo de permisos de un administrador (database-design 3.8). Debe coincidir con el CHECK de usuarios_permisos.
export const PERMISOS = {
  MARCAS_GESTIONAR: 'MARCAS_GESTIONAR',
  CATALOGO_GESTIONAR: 'CATALOGO_GESTIONAR',
  EMPLEADOS_VER: 'EMPLEADOS_VER',
  EMPLEADOS_GESTIONAR: 'EMPLEADOS_GESTIONAR',
  EMPLEADOS_RESTABLECER_PASSWORD: 'EMPLEADOS_RESTABLECER_PASSWORD',
  CURSOS_GESTIONAR: 'CURSOS_GESTIONAR',
  CURSOS_PUBLICAR: 'CURSOS_PUBLICAR',
  CURSOS_ASIGNAR: 'CURSOS_ASIGNAR',
  INTENTOS_OTORGAR: 'INTENTOS_OTORGAR',
  CERTIFICADOS_VER: 'CERTIFICADOS_VER',
  REPORTES_VER: 'REPORTES_VER',
  ASISTENTE_USAR: 'ASISTENTE_USAR',
} as const;

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS];

export const TODOS_LOS_PERMISOS: Permiso[] = Object.values(PERMISOS);

export type GrupoPermisos = 'CATALOGOS' | 'EMPLEADOS' | 'CURSOS' | 'RESULTADOS' | 'ASISTENTE';

export interface DescripcionPermiso {
  permiso: Permiso;
  grupo: GrupoPermisos;
  nombre: string;
  descripcion: string;
  // TODA_LA_PLATAFORMA: recursos compartidos (marcas, catalogo, cursos); SUS_SUCURSALES: datos de sus sucursales
  alcance: 'TODA_LA_PLATAFORMA' | 'SUS_SUCURSALES';
}

export const CATALOGO_PERMISOS: DescripcionPermiso[] = [
  {
    permiso: PERMISOS.MARCAS_GESTIONAR,
    grupo: 'CATALOGOS',
    nombre: 'Gestionar marcas',
    descripcion: 'Crear, editar y desactivar marcas, su logotipo y sus instrucciones del asistente.',
    alcance: 'TODA_LA_PLATAFORMA',
  },
  {
    permiso: PERMISOS.CATALOGO_GESTIONAR,
    grupo: 'CATALOGOS',
    nombre: 'Gestionar áreas y puestos',
    descripcion: 'Crear, editar y desactivar las áreas y los puestos del catálogo.',
    alcance: 'TODA_LA_PLATAFORMA',
  },
  {
    permiso: PERMISOS.EMPLEADOS_VER,
    grupo: 'EMPLEADOS',
    nombre: 'Ver empleados',
    descripcion: 'Ver empleados, su ficha y su avance.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.EMPLEADOS_GESTIONAR,
    grupo: 'EMPLEADOS',
    nombre: 'Gestionar empleados',
    descripcion: 'Dar de alta, editar, cambiar de puesto o de sucursal y dar de baja empleados.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.EMPLEADOS_RESTABLECER_PASSWORD,
    grupo: 'EMPLEADOS',
    nombre: 'Restablecer contraseñas',
    descripcion: 'Restablecer contraseñas y desbloquear cuentas de empleados.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.CURSOS_GESTIONAR,
    grupo: 'CURSOS',
    nombre: 'Gestionar cursos',
    descripcion: 'Crear cursos y editar su contenido y evaluaciones.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.CURSOS_PUBLICAR,
    grupo: 'CURSOS',
    nombre: 'Publicar cursos',
    descripcion: 'Publicar, archivar y reactivar cursos.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.CURSOS_ASIGNAR,
    grupo: 'CURSOS',
    nombre: 'Asignar cursos',
    descripcion: 'Dirigir cursos a sus sucursales o a sus empleados, y retirar esos destinos.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.INTENTOS_OTORGAR,
    grupo: 'RESULTADOS',
    nombre: 'Otorgar intentos',
    descripcion: 'Dar intentos adicionales en una evaluación.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.CERTIFICADOS_VER,
    grupo: 'RESULTADOS',
    nombre: 'Ver certificados',
    descripcion: 'Consultar certificados y buscar por folio.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.REPORTES_VER,
    grupo: 'RESULTADOS',
    nombre: 'Ver reportes',
    descripcion: 'Dashboard, indicadores y reportes en PDF y Excel.',
    alcance: 'SUS_SUCURSALES',
  },
  {
    permiso: PERMISOS.ASISTENTE_USAR,
    grupo: 'ASISTENTE',
    nombre: 'Usar el asistente',
    descripcion: 'Preguntar al asistente sobre los cursos que puede ver.',
    alcance: 'SUS_SUCURSALES',
  },
];

export interface PlantillaPermisos {
  clave: string;
  nombre: string;
  permisos: Permiso[];
}

// Atajos de la pantalla de permisos: marcan varias casillas, no se guardan (D-28)
export const PLANTILLAS_PERMISOS: PlantillaPermisos[] = [
  { clave: 'ADMIN_COMPLETO', nombre: 'Administrador completo', permisos: TODOS_LOS_PERMISOS },
  {
    clave: 'ADMIN_SUCURSAL',
    nombre: 'Administrador de sucursal',
    permisos: [
      PERMISOS.EMPLEADOS_VER,
      PERMISOS.EMPLEADOS_GESTIONAR,
      PERMISOS.EMPLEADOS_RESTABLECER_PASSWORD,
      PERMISOS.CURSOS_ASIGNAR,
      PERMISOS.INTENTOS_OTORGAR,
      PERMISOS.CERTIFICADOS_VER,
      PERMISOS.REPORTES_VER,
      PERMISOS.ASISTENTE_USAR,
    ],
  },
  {
    clave: 'CREADOR_CONTENIDO',
    nombre: 'Creador de contenido',
    permisos: [PERMISOS.CURSOS_GESTIONAR, PERMISOS.CURSOS_PUBLICAR, PERMISOS.CURSOS_ASIGNAR, PERMISOS.ASISTENTE_USAR],
  },
  { clave: 'SOLO_REPORTES', nombre: 'Solo reportes', permisos: [PERMISOS.CERTIFICADOS_VER, PERMISOS.REPORTES_VER] },
];
