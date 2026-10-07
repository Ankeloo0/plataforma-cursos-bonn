import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Recortar, RecortarONulo } from '../../../common/utils/transformaciones.js';
import { ESTADOS_CURSO, type EstadoCurso } from '../entities/curso.entity.js';

export class QueryCursosDto extends PaginationQueryDto {
  // Busca en el titulo
  @Recortar()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsIn(Object.values(ESTADOS_CURSO), { message: 'El estado no es válido.' })
  estado?: EstadoCurso;
}

// RF-04.1. El estado no se envia: el curso nace en borrador y cambia con publicar y archivar (I3.4).
// La duracion tampoco: la calcula el sistema con la duracion de sus videos (D-36).
export class CrearCursoDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el título del curso.' })
  @MaxLength(150, { message: 'El título no puede pasar de 150 caracteres.' })
  titulo: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede pasar de 5000 caracteres.' })
  descripcion?: string | null;

  @IsBoolean({ message: 'Indica si el curso es obligatorio.' })
  esObligatorio: boolean;

  // null = sin fecha limite
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'La fecha límite no es válida.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha límite debe tener el formato AAAA-MM-DD.' })
  fechaLimite?: string | null;

  // RN-04.3: de 0 a 100
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'La calificación mínima debe ser un número con hasta 2 decimales.' })
  @Min(0, { message: 'La calificación mínima va de 0 a 100.' })
  @Max(100, { message: 'La calificación mínima va de 0 a 100.' })
  calificacionMinima: number;
}

// V-13: se envia el actualizadoEn que se leyo; si alguien guardo antes, la API responde 409
export class ActualizarCursoDto extends PartialType(CrearCursoDto) {
  @IsISO8601({ strict: true }, { message: 'Falta la fecha de la última modificación que leíste.' })
  actualizadoEn: string;
}
