import type { EmpresaConResumen } from '../empresas.repository.js';

export class EmpresaResponseDto {
  id: string;
  nombre: string;
  razonSocial: string | null;
  prefijoFolio: string;
  activo: boolean;
  sucursalesActivas: number;
  administradores: number;
  empleadosActivos: number;
  creadoEn: string;
  creadoPor: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;

  static desde(datos: EmpresaConResumen): EmpresaResponseDto {
    const { empresa } = datos;
    return {
      id: empresa.id,
      nombre: empresa.nombre,
      razonSocial: empresa.razonSocial,
      prefijoFolio: empresa.prefijoFolio,
      activo: empresa.activo,
      sucursalesActivas: datos.sucursalesActivas,
      administradores: datos.administradores,
      empleadosActivos: datos.empleadosActivos,
      creadoEn: empresa.creadoEn.toISOString(),
      creadoPor: datos.creadoPorNombre,
      actualizadoEn: empresa.actualizadoEn.toISOString(),
      actualizadoPor: empresa.actualizadoPor ? datos.actualizadoPorNombre : null,
    };
  }
}
