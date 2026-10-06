import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Recortar, RecortarONulo } from '../../../common/utils/transformaciones.js';

export class CrearSucursalDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de la sucursal.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre: string;

  @IsUUID('all', { message: 'Elige la marca de la sucursal.' })
  marcaId: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'La dirección no puede pasar de 250 caracteres.' })
  direccion?: string | null;
}

export class ActualizarSucursalDto {
  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de la sucursal.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Elige la marca de la sucursal.' })
  marcaId?: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'La dirección no puede pasar de 250 caracteres.' })
  direccion?: string | null;
}
