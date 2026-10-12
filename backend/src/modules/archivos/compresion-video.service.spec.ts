import type { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { AlmacenamientoService } from './almacenamiento.service.js';
import type { ArchivosRepository } from './archivos.repository.js';
import { CompresionVideoService } from './compresion-video.service.js';

const ejecutar = promisify(execFile);
const KEY_ORIGINAL = 'materiales/2026/10/original.mp4';

// Usa el FFmpeg real (el mismo de la imagen de api) sobre una carpeta temporal; la base se simula
describe('CompresionVideoService (RF-04.6, P-11)', () => {
  let raiz: string;
  let almacenamiento: AlmacenamientoService;

  beforeEach(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'compresion-'));
    almacenamiento = new AlmacenamientoService({ get: () => raiz } as unknown as ConfigService);
    await mkdir(path.join(raiz, 'materiales/2026/10'), { recursive: true });
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  // Video de prueba generado por FFmpeg: barras de color con ruido para que pese
  async function video(ancho: number, alto: number, calidad: number): Promise<number> {
    await ejecutar('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${ancho}x${alto}:rate=30:duration=1`,
      '-vf', 'noise=alls=40:allf=t', '-c:v', 'libx264', '-crf', String(calidad), '-pix_fmt', 'yuv420p',
      almacenamiento.rutaAbsoluta(KEY_ORIGINAL),
    ]);
    return (await stat(almacenamiento.rutaAbsoluta(KEY_ORIGINAL))).size;
  }

  async function altura(ruta: string): Promise<number> {
    const { stdout } = await ejecutar('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=height', '-of', 'csv=p=0', ruta]);
    return Number(stdout.trim());
  }

  function crear(tamanoBytes: number, guardado = true) {
    const repo = {
      cambiarEstado: vi.fn(),
      idsConEstado: vi.fn().mockResolvedValue([]),
      buscarPorId: vi.fn().mockResolvedValue({ id: 'a1', storageKey: KEY_ORIGINAL, tamanoBytes: String(tamanoBytes), estado: 'PROCESANDO' }),
      guardarComprimido: vi.fn().mockResolvedValue(guardado),
    };
    const servicio = new CompresionVideoService(repo as unknown as ArchivosRepository, almacenamiento);
    return { servicio, repo };
  }

  const existe = (ruta: string) => access(ruta).then(() => true, () => false);

  it('baja un video de 1080p a 720p, lo guarda en la misma carpeta y borra el original', async () => {
    const { servicio, repo } = crear(await video(1920, 1080, 18));

    await servicio.encolar('a1');

    expect(repo.cambiarEstado).toHaveBeenCalledWith('a1', 'PROCESANDO');
    await vi.waitFor(() => expect(repo.guardarComprimido).toHaveBeenCalled(), { timeout: 30_000 });
    const [, storageKey, tamano] = repo.guardarComprimido.mock.calls[0];
    expect(storageKey).toMatch(/^materiales\/2026\/10\/[0-9a-f-]{36}\.mp4$/);
    await vi.waitFor(async () => expect(await existe(almacenamiento.rutaAbsoluta(KEY_ORIGINAL))).toBe(false));
    expect(await altura(almacenamiento.rutaAbsoluta(storageKey))).toBe(720);
    expect((await stat(almacenamiento.rutaAbsoluta(storageKey))).size).toBe(tamano);
    expect(await readdir(almacenamiento.carpetaTemporal)).toHaveLength(0);
  });

  it('si el resultado pesa mas, se queda el original y el video queda LISTO', async () => {
    const { servicio, repo } = crear(await video(320, 180, 51));

    await servicio.encolar('a1');

    await vi.waitFor(() => expect(repo.cambiarEstado).toHaveBeenCalledWith('a1', 'LISTO'), { timeout: 30_000 });
    expect(repo.guardarComprimido).not.toHaveBeenCalled();
    expect(await existe(almacenamiento.rutaAbsoluta(KEY_ORIGINAL))).toBe(true);
    expect(await readdir(almacenamiento.carpetaTemporal)).toHaveLength(0);
  });

  it('si FFmpeg falla, el original se queda y el archivo pasa a ERROR', async () => {
    await writeFile(almacenamiento.rutaAbsoluta(KEY_ORIGINAL), 'no es un video');
    const { servicio, repo } = crear(14);

    await servicio.encolar('a1');

    await vi.waitFor(() => expect(repo.cambiarEstado).toHaveBeenCalledWith('a1', 'ERROR'), { timeout: 30_000 });
    expect(await existe(almacenamiento.rutaAbsoluta(KEY_ORIGINAL))).toBe(true);
  });

  it('si el material se borro mientras comprimia, descarta el video comprimido', async () => {
    const { servicio, repo } = crear(await video(1920, 1080, 18), false);

    await servicio.encolar('a1');

    await vi.waitFor(() => expect(repo.guardarComprimido).toHaveBeenCalled(), { timeout: 30_000 });
    const storageKey = repo.guardarComprimido.mock.calls[0][1] as string;
    await vi.waitFor(async () => expect(await existe(almacenamiento.rutaAbsoluta(storageKey))).toBe(false));
    expect(await existe(almacenamiento.rutaAbsoluta(KEY_ORIGINAL))).toBe(true);
  });

  it('al iniciar retoma los videos que quedaron PROCESANDO', async () => {
    const { servicio, repo } = crear(await video(1920, 1080, 18));
    repo.idsConEstado.mockResolvedValue(['a1']);

    await servicio.onApplicationBootstrap();

    expect(repo.idsConEstado).toHaveBeenCalledWith('PROCESANDO');
    await vi.waitFor(() => expect(repo.guardarComprimido).toHaveBeenCalled(), { timeout: 30_000 });
  });
});
