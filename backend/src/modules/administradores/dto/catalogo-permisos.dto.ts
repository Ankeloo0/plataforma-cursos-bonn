import type { GrupoPermisos, Permiso } from '../../../common/constants/permisos.js';

export class DescripcionPermisoDto {
  permiso: Permiso;
  grupo: GrupoPermisos;
  nombre: string;
  descripcion: string;
  alcance: 'TODA_LA_PLATAFORMA' | 'SUS_SUCURSALES';
}

export class PlantillaPermisosDto {
  clave: string;
  nombre: string;
  permisos: Permiso[];
}

export class CatalogoPermisosDto {
  permisos: DescripcionPermisoDto[];
  plantillas: PlantillaPermisosDto[];
}
