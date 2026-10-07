import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ABooleano, Recortar, RecortarONulo } from '../../../common/utils/transformaciones.js';

// El catalogo es corto: se lista completo, sin paginar
export class QueryAreasDto {
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

export class QueryPuestosDto extends QueryAreasDto {
  @IsOptional()
  @IsUUID('all', { message: 'El área no es válida.' })
  areaId?: string;
}

export class CrearAreaDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre del área.' })
  @MaxLength(100, { message: 'El nombre no puede pasar de 100 caracteres.' })
  nombre: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede pasar de 500 caracteres.' })
  descripcion?: string | null;
}

export class ActualizarAreaDto {
  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre del área.' })
  @MaxLength(100, { message: 'El nombre no puede pasar de 100 caracteres.' })
  nombre?: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede pasar de 500 caracteres.' })
  descripcion?: string | null;
}

export class CrearPuestoDto {
  @IsUUID('all', { message: 'Elige el área del puesto.' })
  areaId: string;

  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre del puesto.' })
  @MaxLength(100, { message: 'El nombre no puede pasar de 100 caracteres.' })
  nombre: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede pasar de 500 caracteres.' })
  descripcion?: string | null;
}

export class ActualizarPuestoDto {
  @IsOptional()
  @IsUUID('all', { message: 'Elige el área del puesto.' })
  areaId?: string;

  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre del puesto.' })
  @MaxLength(100, { message: 'El nombre no puede pasar de 100 caracteres.' })
  nombre?: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede pasar de 500 caracteres.' })
  descripcion?: string | null;
}
