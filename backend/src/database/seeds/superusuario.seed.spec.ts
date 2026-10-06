import type { EntityManager } from 'typeorm';
import { sembrarSuperusuario } from './superusuario.seed.js';

const datos = { username: 'superusuario', password: 'Temporal2026', nombres: 'Ana', apellidoPaterno: 'López' };

// EntityManager simulado que responde las consultas en orden.
function managerQueResponde(...respuestas: unknown[][]): EntityManager & { query: ReturnType<typeof vi.fn> } {
  const query = vi.fn();
  respuestas.forEach((r) => query.mockResolvedValueOnce(r));
  query.mockResolvedValue([]);
  return { query } as unknown as EntityManager & { query: ReturnType<typeof vi.fn> };
}

describe('sembrarSuperusuario', () => {
  it('no hace nada si ya existe un superusuario', async () => {
    const manager = managerQueResponde([{}]);
    expect(await sembrarSuperusuario(manager, datos)).toBe('ya-existia');
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it('se detiene con un mensaje claro si otra cuenta ya usa ese nombre de usuario', async () => {
    const manager = managerQueResponde([], [{}]);
    await expect(sembrarSuperusuario(manager, datos)).rejects.toThrow('ya existe y no es el superusuario');
  });

  it('guarda el hash y nunca la contraseña en texto plano', async () => {
    const manager = managerQueResponde([], []);
    expect(await sembrarSuperusuario(manager, datos)).toBe('creado');

    const parametros: unknown[] = manager.query.mock.calls[2][1];
    expect(parametros).not.toContain('Temporal2026');
    expect(String(parametros[2])).toMatch(/^\$2b\$12\$/);
  });
});
