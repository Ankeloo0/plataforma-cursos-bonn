import { OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { ABooleano, Recortar } from '../../../common/utils/transformaciones.js';
import { CrearCuentaDto } from '../../usuarios/dto/datos-cuenta.dto.js';

const NUMERO_FORMATO = /^[A-Za-z0-9-]{1,20}$/;
const NUMERO_MENSAJE = 'El número de empleado solo puede tener letras sin acentos, números y guion, hasta 20 caracteres.';

export class QueryEmpleadosDto extends PaginationQueryDto {
  // Nombre, apellidos o numero de empleado
  @Recortar()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID('all', { message: 'La sucursal no es válida.' })
  sucursalId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'El área no es válida.' })
  areaId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'El puesto no es válido.' })
  puestoId?: string;

  @ABooleano()
  @IsOptional()
  @IsBoolean({ message: 'activo debe ser true o false' })
  activo?: boolean;
}

// El empleado no tiene usuario: entra con su empresa y su numero (D-34)
export class CrearEmpleadoDto extends OmitType(CrearCuentaDto, ['username'] as const) {
  @IsUUID('all', { message: 'Elige la sucursal.' })
  sucursalId: string;

  @Recortar()
  @IsString()
  @Matches(NUMERO_FORMATO, { message: NUMERO_MENSAJE })
  numeroEmpleado: string;

  @IsUUID('all', { message: 'Elige el puesto.' })
  puestoId: string;

  @IsISO8601({ strict: true }, { message: 'La fecha de ingreso no es válida.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de ingreso debe tener el formato AAAA-MM-DD.' })
  fechaIngreso: string;
}

// Datos, puesto y sucursal (traslado solo dentro de la misma empresa, RF-03.3). La contrasena se
// restablece en /usuarios/:id/restablecer-password.
export class ActualizarEmpleadoDto extends PartialType(OmitType(CrearEmpleadoDto, ['passwordTemporal'] as const)) {}
