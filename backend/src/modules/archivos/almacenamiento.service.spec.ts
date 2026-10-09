import type { ConfigService } from '@nestjs/config';
import { access, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
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

  it('mueve un temporal a su lugar sin sobrescribir otro archivo', async () => {
    await mkdir(almacenamiento.carpetaTemporal, { recursive: true });
    const temporal = path.join(almacenamiento.carpetaTemporal, 'subida');
    await writeFile(temporal, 'video');

    await almacenamiento.mover(temporal, 'materiales/2026/10/v.mp4');
    expect(await readFile(path.join(raiz, 'materiales/2026/10/v.mp4'), 'utf8')).toBe('video');
    await expect(access(temporal)).rejects.toThrow();

    await writeFile(temporal, 'otro');
    await expect(almacenamiento.mover(temporal, 'materiales/2026/10/v.mp4')).rejects.toThrow();
  });

  it('borra solo los temporales anteriores a la fecha indicada', async () => {
    await mkdir(almacenamiento.carpetaTemporal, { recursive: true });
    const viejo = path.join(almacenamiento.carpetaTemporal, 'viejo');
    const nuevo = path.join(almacenamiento.carpetaTemporal, 'nuevo');
    await writeFile(viejo, 'x');
    await writeFile(nuevo, 'x');
    const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(viejo, hace2Dias, hace2Dias);

    expect(await almacenamiento.limpiarTemporales(new Date(Date.now() - 24 * 60 * 60 * 1000))).toBe(1);
    await expect(access(viejo)).rejects.toThrow();
    await access(nuevo);
  });

  it('rechaza una storage_key que sale de la carpeta del storage', () => {
    expect(() => almacenamiento.rutaAbsoluta('../../etc/passwd')).toThrow('fuera del storage');
  });
});
