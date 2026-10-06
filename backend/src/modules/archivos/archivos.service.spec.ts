import type { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { AlmacenamientoService } from './almacenamiento.service.js';
import type { ArchivosRepository } from './archivos.repository.js';
import { ArchivosService } from './archivos.service.js';

function crear() {
  const repo = { crear: vi.fn((datos: object) => Promise.resolve({ id: 'a1', ...datos })) };
  const storage = { guardar: vi.fn(), eliminar: vi.fn() };
  const config = { get: () => 'development' } as unknown as ConfigService;
  const servicio = new ArchivosService(repo as unknown as ArchivosRepository, storage as unknown as AlmacenamientoService, config);
  return { servicio, repo, storage };
}

function archivo(buffer: Buffer, nombre = 'foto.png'): Express.Multer.File {
  return { buffer, size: buffer.length, originalname: nombre } as Express.Multer.File;
}

const imagenPng = () =>
  sharp({ create: { width: 900, height: 600, channels: 3, background: '#225380' } }).png().toBuffer();

describe('ArchivosService.guardarFoto (P-45)', () => {
  it('recorta la foto a 512 x 512, la guarda como WebP y registra quien la subio', async () => {
    const { servicio, storage, repo } = crear();

    await servicio.guardarFoto(archivo(await imagenPng()), 'u1');

    const [contenido, storageKey] = storage.guardar.mock.calls[0];
    expect(storageKey).toMatch(/^fotos\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(await sharp(contenido as Buffer).metadata()).toMatchObject({ width: 512, height: 512, format: 'webp' });
    expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/webp', creadoPor: 'u1' }));
  });

  it('rechaza un archivo que no es imagen aunque su nombre diga .jpg', async () => {
    const { servicio, storage } = crear();
    const pdfDisfrazado = archivo(Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n'), 'foto.jpg');

    await expect(servicio.guardarFoto(pdfDisfrazado, 'u1')).rejects.toMatchObject({
      response: { code: 'ARCHIVO_TIPO_NO_PERMITIDO' },
    });
    expect(storage.guardar).not.toHaveBeenCalled();
  });

  it('pide un archivo si no se envio ninguno', async () => {
    await expect(crear().servicio.guardarFoto(undefined, 'u1')).rejects.toMatchObject({
      response: { code: 'ARCHIVO_REQUERIDO' },
    });
  });

  it('si no se puede registrar el archivo, lo borra del storage', async () => {
    const { servicio, repo, storage } = crear();
    repo.crear.mockRejectedValueOnce(new Error('fallo'));

    await expect(servicio.guardarFoto(archivo(await imagenPng()), 'u1')).rejects.toThrow('fallo');
    expect(storage.eliminar).toHaveBeenCalledWith(storage.guardar.mock.calls[0][1]);
  });
});

describe('ArchivosService.entregar (T-06)', () => {
  const sesion = { id: 'u1', rol: 'SUPERUSUARIO', sucursalId: null, alcance: { sinLimite: true, sucursalIds: [] } } as never;

  function crearCon(env: string) {
    const repo = {
      buscarPorId: vi.fn().mockResolvedValue({ id: 'a1', storageKey: 'fotos/2026/10/x.webp', mimeType: 'image/webp' }),
      buscarUso: vi.fn().mockResolvedValue({ duenoId: 'u1', sucursalDelDueno: null }),
    };
    const storage = { rutaAbsoluta: vi.fn((k: string) => `/storage/${k}`) };
    const config = { get: () => env } as unknown as ConfigService;
    const res = { setHeader: vi.fn(), end: vi.fn(), sendFile: vi.fn() };
    const servicio = new ArchivosService(repo as unknown as ArchivosRepository, storage as unknown as AlmacenamientoService, config);
    return { servicio, res };
  }

  it('en produccion delega el envio a nginx con X-Accel-Redirect', async () => {
    const { servicio, res } = crearCon('production');
    await servicio.entregar('a1', sesion, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Redirect', '/_protegido/fotos/2026/10/x.webp');
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('en desarrollo lo envia Node con sendFile', async () => {
    const { servicio, res } = crearCon('development');
    await servicio.entregar('a1', sesion, res as never);
    expect(res.sendFile).toHaveBeenCalledWith('/storage/fotos/2026/10/x.webp');
  });
});
