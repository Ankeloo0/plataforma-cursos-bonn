import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

// Parametros de paginacion: `?page=1&limit=20` (technical-spec 4.5, T-13).
// Los DTOs de consulta de cada modulo la extienden y agregan sus filtros:
//
//  export class QueryEmpleadosDto extends PaginationQueryDto { @IsOptional() @IsString() search?: string; }
export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser 1 o mayor' })
  page: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser 1 o mayor' })
  @Max(100, { message: 'limit no puede ser mayor que 100' })
  limit: number = 20;

  // Cuantos registros saltar en la consulta (`OFFSET`).
  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}
