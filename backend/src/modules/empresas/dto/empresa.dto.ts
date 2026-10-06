import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { ABooleano, Recortar, RecortarONulo } from '../../../common/utils/transformaciones.js';

export class QueryEmpresasDto extends PaginationQueryDto {
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

const PREFIJO_FORMATO = /^[A-Z0-9]{2,6}$/;
const PREFIJO_MENSAJE = 'El prefijo del folio debe tener de 2 a 6 letras sin acentos o números, por ejemplo GB.';
const AMayusculas = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

export class CrearEmpresaDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de la empresa.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre: string;

  @AMayusculas()
  @IsString()
  @Matches(PREFIJO_FORMATO, { message: PREFIJO_MENSAJE })
  prefijoFolio: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La razón social no puede pasar de 200 caracteres.' })
  razonSocial?: string | null;
}

export class ActualizarEmpresaDto {
  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre de la empresa.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre?: string;

  @AMayusculas()
  @IsOptional()
  @IsString()
  @Matches(PREFIJO_FORMATO, { message: PREFIJO_MENSAJE })
  prefijoFolio?: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La razón social no puede pasar de 200 caracteres.' })
  razonSocial?: string | null;
}
