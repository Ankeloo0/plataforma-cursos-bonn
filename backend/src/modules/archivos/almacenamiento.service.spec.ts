import type { ConfigService } from '@nestjs/config';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AlmacenamientoService } from './almacenamiento.service.js';

describe('AlmacenamientoService', () => {
  let raiz: string;
  let almacenamiento: AlmacenamientoService;

  beforeEach(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'bonn-storage-'));
    almacenamiento = new AlmacenamientoService({ get: () => raiz } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it('guarda y elimina un archivo creando sus carpetas', async () => {
    await almacenamiento.guardar(Buffer.from('hola'), 'fotos/2026/10/a.webp');
    expect(await readFile(path.join(raiz, 'fotos/2026/10/a.webp'), 'utf8')).toBe('hola');

    await almacenamiento.eliminar('fotos/2026/10/a.webp');
    await expect(access(path.join(raiz, 'fotos/2026/10/a.webp'))).rejects.toThrow();
  });

  it('nunca sobrescribe un archivo existente', async () => {
    await almacenamiento.guardar(Buffer.from('uno'), 'a.webp');
    await expect(almacenamiento.guardar(Buffer.from('dos'), 'a.webp')).rejects.toThrow();
  });

  it('rechaza una storage_key que sale de la carpeta del storage', () => {
    expect(() => almacenamiento.rutaAbsoluta('../../etc/passwd')).toThrow('fuera del storage');
  });
});
