import { DataSource } from 'typeorm';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reporta ok cuando la base de datos responde', async () => {
    const dataSource = { query: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as DataSource;
    const result = await new HealthService(dataSource).check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
  });

  it('reporta error cuando la base de datos no responde', async () => {
    const dataSource = { query: vi.fn().mockRejectedValue(new Error('connection refused')) } as unknown as DataSource;
    const result = await new HealthService(dataSource).check();

    expect(result.status).toBe('error');
    expect(result.database).toBe('down');
  });
});
