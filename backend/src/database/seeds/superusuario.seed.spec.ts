import type { EntityManager } from 'typeorm';
import { sembrarSuperusuario } from './superusuario.seed.js';

const datos = {
  empresa: 'Grupo Bonn',
  prefijoFolio: 'GB',
  numeroEmpleado: '1',
  password: 'Temporal2026',
  nombres: 'Ana',
  apellidoPaterno: 'López',
};

// EntityManager simulado que responde las consultas en orden.
function managerQueResponde(...respuestas: unknown[][]): EntityManager & { query: ReturnType<typeof vi.fn> } {
  const query = vi.fn();
  respuestas.forEach((r) => query.mockResolvedValueOnce(r));
  query.mockResolvedValue([]);
  return { query } as unknown as EntityManager & { query: ReturnType<typeof vi.fn> };
}

describe('sembrarSuperusuario', () => {
  it('no hace nada si ya existe un superusuario con número', async () => {
    const manager = managerQueResponde([{ id: 's1', numero_empleado: '1' }]);
    expect(await sembrarSuperusuario(manager, datos)).toBe('ya-existia');
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it('guarda el hash y nunca la contraseña en texto plano', async () => {
    const manager = managerQueResponde([], [{ id: 's1' }], [], [{ id: 'e1' }], []);
    expect(await sembrarSuperusuario(manager, datos)).toBe('creado');

    const parametros: unknown[] = manager.query.mock.calls[1][1];
    expect(parametros).not.toContain('Temporal2026');
    expect(String(parametros[1])).toMatch(/^\$2b\$12\$/);
  });

  it('crea la empresa si no existe y le asigna al superusuario su empresa y su número', async () => {
    const manager = managerQueResponde([], [{ id: 's1' }], [], [{ id: 'e1' }], []);
    await sembrarSuperusuario(manager, datos);

    expect(manager.query.mock.calls[3][1]).toEqual(['Grupo Bonn', 'GB', 's1']);
    expect(manager.query.mock.calls[5][1]).toEqual(['e1', '1', 's1']);
  });

  it('a un superusuario sin número solo le asigna empresa y número, sin tocar su contraseña', async () => {
    const manager = managerQueResponde([{ id: 's1', numero_empleado: null }], [{ id: 'e1' }], []);
    expect(await sembrarSuperusuario(manager, datos)).toBe('numero-asignado');

    const consultas = manager.query.mock.calls.map((llamada) => String(llamada[0]));
    expect(consultas.some((sql) => sql.includes('INSERT INTO usuarios'))).toBe(false);
    expect(manager.query.mock.calls.at(-1)?.[1]).toEqual(['e1', '1', 's1']);
  });

  it('se detiene con un mensaje claro si otra cuenta ya usa ese número en la empresa', async () => {
    const manager = managerQueResponde([{ id: 's1', numero_empleado: null }], [{ id: 'e1' }], [{}]);
    await expect(sembrarSuperusuario(manager, datos)).rejects.toThrow('Usa otro SUPERUSER_NUMERO_EMPLEADO');
  });
});
