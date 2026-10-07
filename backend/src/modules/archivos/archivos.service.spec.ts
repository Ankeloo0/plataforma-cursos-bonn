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

describe('ArchivosService.guardarPortada (RF-04.6)', () => {
  const imagen = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: '#c48139' } }).jpeg().toBuffer();

  it('reduce la portada a 1280 px en su lado mayor, sin recortar, y la guarda como WebP', async () => {
    const { servicio, storage } = crear();

    await servicio.guardarPortada(archivo(await imagen(3000, 2000), 'portada.jpg'), 'u1');

    const [contenido, storageKey] = storage.guardar.mock.calls[0];
    expect(storageKey).toMatch(/^portadas\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(await sharp(contenido as Buffer).metadata()).toMatchObject({ width: 1280, height: 853, format: 'webp' });
  });

  it('no agranda una imagen mas chica', async () => {
    const { servicio, storage } = crear();

    await servicio.guardarPortada(archivo(await imagen(800, 450), 'portada.jpg'), 'u1');

    expect(await sharp(storage.guardar.mock.calls[0][0] as Buffer).metadata()).toMatchObject({ width: 800, height: 450 });
  });

  it('rechaza una portada de mas de 50 MB sin leerla', async () => {
    const { servicio, storage } = crear();
    const pesada = { buffer: Buffer.alloc(1), size: 51 * 1024 * 1024, originalname: 'grande.jpg' } as Express.Multer.File;

    await expect(servicio.guardarPortada(pesada, 'u1')).rejects.toMatchObject({
      response: { code: 'ARCHIVO_DEMASIADO_GRANDE', message: 'La portada pesa más de 50 MB. Elige una imagen más ligera.' },
    });
    expect(storage.guardar).not.toHaveBeenCalled();
  });
});

describe('ArchivosService.entregar: quien ve una portada', () => {
  function crearCon(sesion: object) {
    const repo = {
      buscarPorId: vi.fn().mockResolvedValue({ id: 'a1', storageKey: 'portadas/2026/10/x.webp', mimeType: 'image/webp' }),
      buscarUso: vi.fn().mockResolvedValue({ tipo: 'PORTADA', creadorDelCurso: 'creador' }),
    };
    const storage = { rutaAbsoluta: vi.fn((k: string) => `/storage/${k}`) };
    const config = { get: () => 'development' } as unknown as ConfigService;
    const servicio = new ArchivosService(repo as unknown as ArchivosRepository, storage as unknown as AlmacenamientoService, config);
    const res = { setHeader: vi.fn(), end: vi.fn(), sendFile: vi.fn() };
    return { entregar: () => servicio.entregar('a1', sesion as never, res as never), res };
  }
  const admin = (id: string) => ({ id, rol: 'ADMIN', sucursalId: null, alcance: { sinLimite: false, sucursalIds: ['s1'] } });

  it('la ve quien creo el curso', async () => {
    const { entregar, res } = crearCon(admin('creador'));
    await entregar();
    expect(res.sendFile).toHaveBeenCalled();
  });

  it('otro administrador recibe 404, como si no existiera', async () => {
    await expect(crearCon(admin('otro')).entregar()).rejects.toMatchObject({ response: { code: 'ARCHIVO_NO_ENCONTRADO' } });
  });
});

describe('ArchivosService.entregar (T-06)', () => {
  const sesion = { id: 'u1', rol: 'SUPERUSUARIO', sucursalId: null, alcance: { sinLimite: true, sucursalIds: [] } } as never;

  function crearCon(env: string) {
    const repo = {
      buscarPorId: vi.fn().mockResolvedValue({ id: 'a1', storageKey: 'fotos/2026/10/x.webp', mimeType: 'image/webp' }),
      buscarUso: vi.fn().mockResolvedValue({ tipo: 'FOTO', duenoId: 'u1', sucursalDelDueno: null }),
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
