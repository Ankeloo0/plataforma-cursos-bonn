import { IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLITICA, PASSWORD_POLITICA_MENSAJE } from '../../../common/constants/seguridad.js';
import { Recortar, RecortarONulo } from '../../../common/utils/transformaciones.js';

const USERNAME_FORMATO = /^[A-Za-z0-9._-]+$/;
const USERNAME_MENSAJE = 'El usuario solo puede tener letras sin acentos, números, punto, guion y guion bajo.';

// Datos de cuenta del alta de administradores. El empleado (I2) usa los mismos sin username (D-34)
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
  @Length(3, 50, { message: 'El usuario debe tener entre 3 y 50 caracteres.' })
  @Matches(USERNAME_FORMATO, { message: USERNAME_MENSAJE })
  username: string;

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
  @Length(3, 50, { message: 'El usuario debe tener entre 3 y 50 caracteres.' })
  @Matches(USERNAME_FORMATO, { message: USERNAME_MENSAJE })
  username?: string;
}

export class RestablecerPasswordDto {
  @IsString()
  @Matches(PASSWORD_POLITICA, { message: PASSWORD_POLITICA_MENSAJE })
  @MaxLength(72, { message: 'La contraseña no puede pasar de 72 caracteres.' })
  passwordTemporal: string;
}
