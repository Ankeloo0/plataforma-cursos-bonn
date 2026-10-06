import { urlArchivo } from '../../archivos/archivos.service.js';
import type { MarcaConResumen } from '../marcas.repository.js';

export class MarcaResponseDto {
  id: string;
  nombre: string;
  logoUrl: string | null;
  instruccionesAsistente: string | null;
  activo: boolean;
  // A cuantas sucursales y empresas afecta un cambio (RF-00.7)
  sucursales: number;
  empresas: number;
  creadoEn: string;
  creadoPor: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;

  static desde({ marca, sucursales, empresas, creadoPorNombre, actualizadoPorNombre }: MarcaConResumen): MarcaResponseDto {
    return {
      id: marca.id,
      nombre: marca.nombre,
      logoUrl: urlArchivo(marca.logoArchivoId),
      instruccionesAsistente: marca.instruccionesAsistente,
      activo: marca.activo,
      sucursales,
      empresas,
      creadoEn: marca.creadoEn.toISOString(),
      creadoPor: creadoPorNombre,
      actualizadoEn: marca.actualizadoEn.toISOString(),
      actualizadoPor: marca.actualizadoPor ? actualizadoPorNombre : null,
    };
  }
}
