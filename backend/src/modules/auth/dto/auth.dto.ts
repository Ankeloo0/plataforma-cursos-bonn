import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLITICA, PASSWORD_POLITICA_MENSAJE } from '../../../common/constants/seguridad.js';
import { Recortar } from '../../../common/utils/transformaciones.js';

// El numero de empleado solo es unico dentro de la empresa, por eso se pide la empresa
export class LoginDto {
  @IsUUID('all', { message: 'Elige tu empresa.' })
  empresaId: string;

  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu número de empleado.' })
  @MaxLength(20)
  numeroEmpleado: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe tu contraseña.' })
  @MaxLength(72)
  password: string;
}

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu contraseña actual.' })
  @MaxLength(72)
  passwordActual: string;

  @IsString()
  @Matches(PASSWORD_POLITICA, { message: PASSWORD_POLITICA_MENSAJE })
  @MaxLength(72, { message: 'La contraseña no puede pasar de 72 caracteres.' })
  passwordNueva: string;
}
