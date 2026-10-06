import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PaginatedResponseDto } from './paginated-response.dto.js';
import { PaginationQueryDto } from './pagination-query.dto.js';

function query(valores: Record<string, string>): { dto: PaginationQueryDto; errores: string[] } {
  const dto = plainToInstance(PaginationQueryDto, valores);
  const errores = validateSync(dto).flatMap((e) => Object.values(e.constraints ?? {}));
  return { dto, errores };
}

describe('PaginationQueryDto', () => {
  it('usa page=1 y limit=20 si no se envían', () => {
    const { dto, errores } = query({});
    expect(errores).toEqual([]);
    expect(dto).toMatchObject({ page: 1, limit: 20, offset: 0 });
  });

  it('convierte los parámetros de texto de la URL a números y calcula el offset', () => {
    const { dto, errores } = query({ page: '3', limit: '25' });
    expect(errores).toEqual([]);
    expect(dto.offset).toBe(50);
  });

  it('rechaza limit mayor que 100 y page menor que 1', () => {
    expect(query({ limit: '101' }).errores).toContain('limit no puede ser mayor que 100');
    expect(query({ page: '0' }).errores).toContain('page debe ser 1 o mayor');
  });
});

describe('PaginatedResponseDto', () => {
  it('arma data y meta con el total de páginas', () => {
    const respuesta = PaginatedResponseDto.crear(['a', 'b'], 134, { page: 1, limit: 20 });
    expect(respuesta).toEqual({ data: ['a', 'b'], meta: { page: 1, limit: 20, total: 134, totalPages: 7 } });
  });

  it('devuelve 0 páginas cuando no hay registros', () => {
    expect(PaginatedResponseDto.crear([], 0, { page: 1, limit: 20 }).meta.totalPages).toBe(0);
  });
});
