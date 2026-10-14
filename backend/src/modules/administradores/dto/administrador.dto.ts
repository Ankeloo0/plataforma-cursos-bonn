import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TODOS_LOS_PERMISOS, type Permiso } from '../../../common/constants/permisos.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { ABooleano, Recortar } from '../../../common/utils/transformaciones.js';
import { ActualizarCuentaDto, CrearCuentaDto } from '../../usuarios/dto/datos-cuenta.dto.js';

//la empresa del numero de empleado; no limita las sucursales que administra
export class CrearAdministradorDto extends CrearCuentaDto {
  @IsUUID('all', { message: 'Elige la empresa.' })
  empresaId: string;
}

export class ActualizarAdministradorDto extends ActualizarCuentaDto {
  @IsOptional()
  @IsUUID('all', { message: 'Elige la empresa.' })
  empresaId?: string;
}

export class QueryAdministradoresDto extends PaginationQueryDto {
  @Recortar()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ABooleano()
  @IsOptional()
  @IsBoolean({ message: 'activo debe ser true o false' })
  activo?: boolean;
}

// La pantalla de permisos envia las dos listas completas (RF-00.8)
export class AccesoAdministradorDto {
  @IsArray()
  @ArrayMaxSize(TODOS_LOS_PERMISOS.length)
  @IsIn(TODOS_LOS_PERMISOS, { each: true, message: 'Uno de los permisos no existe.' })
  permisos: Permiso[];

  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true, message: 'Una de las sucursales no es válida.' })
  sucursalIds: string[];
}
