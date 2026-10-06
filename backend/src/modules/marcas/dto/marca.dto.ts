import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ABooleano, Recortar, RecortarONulo } from '../../../common/utils/transformaciones.js';

export class QueryMarcasDto {
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

export class CrearMarcaDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de la marca.' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres.' })
  nombre: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: 'Las instrucciones no pueden pasar de 4000 caracteres.' })
  instruccionesAsistente?: string | null;
}

export class ActualizarMarcaDto {
  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de la marca.' })
  @MaxLength(80, { message: 'El nombre no puede pasar de 80 caracteres.' })
  nombre?: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: 'Las instrucciones no pueden pasar de 4000 caracteres.' })
  instruccionesAsistente?: string | null;
}
