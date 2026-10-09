import { PartialType, PickType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Recortar, RecortarONulo } from '../../../common/utils/transformaciones.js';
import { TIPOS_MATERIAL, type TipoMaterial } from '../entities/material.entity.js';

// RF-04.3
export class CrearTemaDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el título del tema.' })
  @MaxLength(150, { message: 'El título no puede pasar de 150 caracteres.' })
  titulo: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede pasar de 5000 caracteres.' })
  descripcion?: string | null;
}

// V-13: se envia el actualizadoEn que se leyo
export class ActualizarTemaDto extends PartialType(CrearTemaDto) {
  @IsISO8601({ strict: true }, { message: 'Falta la fecha de la última modificación que leíste.' })
  actualizadoEn: string;
}

// Lista completa de ids en el nuevo orden (database-design 4.3)
export class OrdenDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Envía el nuevo orden.' })
  @ArrayMaxSize(500)
  @ArrayUnique({ message: 'El orden tiene elementos repetidos.' })
  @IsUUID('all', { each: true, message: 'Uno de los elementos del orden no es válido.' })
  ids: string[];
}

// Los articulos se habilitan en I3.3 (D-37): mientras tanto la API rechaza ese tipo
export const TIPOS_MATERIAL_HABILITADOS: TipoMaterial[] = [
  TIPOS_MATERIAL.VIDEO,
  TIPOS_MATERIAL.PDF,
  TIPOS_MATERIAL.IMAGEN,
  TIPOS_MATERIAL.DOCUMENTO,
  TIPOS_MATERIAL.ENLACE,
];

const URL_EXTERNA = { protocols: ['http', 'https'], require_protocol: true };
const MENSAJE_URL = 'Escribe una dirección completa que empiece con http:// o https://.';

// RF-04.4. El archivo se sube antes con POST /archivos (technical-spec 4.8); el enlace va en urlExterna.
export class CrearMaterialDto {
  @IsIn(TIPOS_MATERIAL_HABILITADOS, { message: 'El tipo de material no es válido.' })
  tipo: TipoMaterial;

  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'Escribe el título del material.' })
  @MaxLength(150, { message: 'El título no puede pasar de 150 caracteres.' })
  titulo: string;

  @RecortarONulo()
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'La descripción no puede pasar de 5000 caracteres.' })
  descripcion?: string | null;

  @ValidateIf((dto: CrearMaterialDto) => dto.tipo !== TIPOS_MATERIAL.ENLACE)
  @IsUUID('all', { message: 'Sube un archivo para este material.' })
  archivoId?: string;

  @ValidateIf((dto: CrearMaterialDto) => dto.tipo === TIPOS_MATERIAL.ENLACE)
  @Recortar()
  @IsUrl(URL_EXTERNA, { message: MENSAJE_URL })
  @MaxLength(500, { message: 'La dirección no puede pasar de 500 caracteres.' })
  urlExterna?: string;
}

// El tipo no cambia. archivoId reemplaza el archivo (el anterior se borra) y urlExterna, el enlace.
export class ActualizarMaterialDto extends PartialType(PickType(CrearMaterialDto, ['titulo', 'descripcion'] as const)) {
  @IsOptional()
  @IsUUID('all', { message: 'El archivo no es válido.' })
  archivoId?: string;

  @IsOptional()
  @Recortar()
  @IsUrl(URL_EXTERNA, { message: MENSAJE_URL })
  @MaxLength(500, { message: 'La dirección no puede pasar de 500 caracteres.' })
  urlExterna?: string;

  @IsISO8601({ strict: true }, { message: 'Falta la fecha de la última modificación que leíste.' })
  actualizadoEn: string;
}
