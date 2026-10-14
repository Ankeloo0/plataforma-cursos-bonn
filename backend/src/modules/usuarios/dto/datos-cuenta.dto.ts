import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLITICA, PASSWORD_POLITICA_MENSAJE } from '../../../common/constants/seguridad.js';
import { Recortar, RecortarONulo } from '../../../common/utils/transformaciones.js';

const NUMERO_FORMATO = /^[A-Za-z0-9-]{1,20}$/;
const NUMERO_MENSAJE = 'El número de empleado solo puede tener letras sin acentos, números y guion, hasta 20 caracteres.';

//datos de cuenta comunes al alta de administradores y empleados
export class CrearCuentaDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe los nombres.' })
  @MaxLength(80, { message: 'Los nombres no pueden pasar de 80 caracteres.' })
  nombres: string;

  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el apellido paterno.' })
  @MaxLength(60, { message: 'El apellido paterno no puede pasar de 60 caracteres.' })
  apellidoPaterno: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'El apellido materno no puede pasar de 60 caracteres.' })
  apellidoMaterno?: string | null;

  @Recortar()
  @IsString()
  @Matches(NUMERO_FORMATO, { message: NUMERO_MENSAJE })
  numeroEmpleado: string;

  @IsString()
  @Matches(PASSWORD_POLITICA, { message: PASSWORD_POLITICA_MENSAJE })
  @MaxLength(72, { message: 'La contraseña no puede pasar de 72 caracteres.' })
  passwordTemporal: string;
}

export class ActualizarCuentaDto {
  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Escribe los nombres.' })
  @MaxLength(80, { message: 'Los nombres no pueden pasar de 80 caracteres.' })
  nombres?: string;

  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el apellido paterno.' })
  @MaxLength(60, { message: 'El apellido paterno no puede pasar de 60 caracteres.' })
  apellidoPaterno?: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'El apellido materno no puede pasar de 60 caracteres.' })
  apellidoMaterno?: string | null;

  @Recortar()
  @IsOptional()
  @IsString()
  @Matches(NUMERO_FORMATO, { message: NUMERO_MENSAJE })
  numeroEmpleado?: string;
}

export class RestablecerPasswordDto {
  @IsString()
  @Matches(PASSWORD_POLITICA, { message: PASSWORD_POLITICA_MENSAJE })
  @MaxLength(72, { message: 'La contraseña no puede pasar de 72 caracteres.' })
  passwordTemporal: string;
}
