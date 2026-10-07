export type Rol = 'SUPERUSUARIO' | 'ADMIN' | 'EMPLEADO';

// Catalogo de permisos de un administrador (database-design 3.8)
export type Permiso =
  | 'MARCAS_GESTIONAR'
  | 'CATALOGO_GESTIONAR'
  | 'EMPLEADOS_VER'
  | 'EMPLEADOS_GESTIONAR'
  | 'EMPLEADOS_RESTABLECER_PASSWORD'
  | 'CURSOS_GESTIONAR'
  | 'CURSOS_PUBLICAR'
  | 'CURSOS_ASIGNAR'
  | 'INTENTOS_OTORGAR'
  | 'CERTIFICADOS_VER'
  | 'REPORTES_VER'
  | 'ASISTENTE_USAR';

export interface SucursalResumen {
  id: string;
  nombre: string;
  empresa: { id: string; nombre: string };
  marca: { id: string; nombre: string };
}

// Empresas activas para el inicio de sesion del empleado (/auth/empresas)
export interface EmpresaLogin {
  id: string;
  nombre: string;
}

// Datos laborales del empleado (RF-01.7)
export interface DatosLaborales {
  numeroEmpleado: string;
  fechaIngreso: string;
  puesto: { id: string; nombre: string };
  area: { id: string; nombre: string };
}

// Respuesta de /auth/me y /perfil
export interface Perfil {
  id: string;
  // null para el empleado: entra con su empresa y su numero de empleado (D-34)
  username: string | null;
  rol: Rol;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  fotoUrl: string | null;
  debeCambiarPassword: boolean;
  ultimoAccesoEn: string | null;
  // Superusuario: todos; administrador: los que le marco el superusuario; empleado: ninguno
  permisos: Permiso[];
  // Administrador: las sucursales activas en las que opera
  sucursales: SucursalResumen[];
  // Empleado: su sucursal y sus datos laborales
  sucursal: SucursalResumen | null;
  empleado: DatosLaborales | null;
}
