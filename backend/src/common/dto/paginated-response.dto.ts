import { ApiHideProperty } from '@nestjs/swagger';
import type { PaginationQueryDto } from './pagination-query.dto.js';

export class PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Respuesta de todo listado paginado: { data: [...], meta: { page, limit, total, totalPages } }
export class PaginatedResponseDto<T> {
  // Campo generico: el plugin de Swagger no puede describirlo y sin esto la API no arranca con Swagger encendido
  @ApiHideProperty()
  data: T[];
  meta: PaginationMeta;

  static crear<T>(data: T[], total: number, query: Pick<PaginationQueryDto, 'page' | 'limit'>): PaginatedResponseDto<T> {
    const respuesta = new PaginatedResponseDto<T>();
    respuesta.data = data;
    respuesta.meta = {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
    return respuesta;
  }
}
