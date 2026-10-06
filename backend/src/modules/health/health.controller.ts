import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService, HealthStatus } from './health.service.js';

// Verifica que la API este arriba y conectada a PostgreSQL.
// Lo usa el healthcheck de Docker en produccion: nginx no arranca hasta que responde 200.
@ApiTags('Sistema')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({ summary: 'Estado de la API y de la base de datos', description: 'Lo usa el healthcheck de Docker en producción. Responde 503 si la base no responde.' })
  @ApiServiceUnavailableResponse({ description: 'La base de datos no responde.' })
  @Get()
  async check(): Promise<HealthStatus> {
    const health = await this.healthService.check();
    if (health.status !== 'ok') {
      throw new ServiceUnavailableException({ message: 'Base de datos no disponible', code: 'DB_DOWN' });
    }
    return health;
  }
}
