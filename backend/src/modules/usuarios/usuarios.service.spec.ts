import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import type { ArchivosService } from '../archivos/archivos.service.js';
import type { AlcanceService } from './alcance.service.js';
import type { Usuario } from './entities/usuario.entity.js';
import type { UsuariosRepository } from './usuarios.repository.js';
import { UsuariosService } from './usuarios.service.js';

const superusuario: UsuarioSesion = {
  id: 's1',
  rol: 'SUPERUSUARIO',
  debeCambiarPassword: false,
  permisos: [],
  alcance: { sinLimite: true, sucursalIds: [] },
  sucursalId: null,
};
const adminA: UsuarioSesion = {
  id: 'a1',
  rol: 'ADMIN',
  debeCambiarPassword: false,
  permisos: [],
  alcance: { sinLimite: false, sucursalIds: ['A'] },
  sucursalId: null,
};

function usuario(datos: Partial<Usuario>): Usuario {
  return {
    id: 'x',
    rol: 'ADMIN',
    sucursalId: null,
    activo: true,
    versionToken: 0,
    debeCambiarPassword: false,
    fotoArchivoId: null,
    ...datos,
  } as Usuario;
}

function crear(encontrado: Usuario | null) {
  const repo = {
    buscarPorId: vi.fn().mockResolvedValue(encontrado),
    guardar: vi.fn((u: Usuario) => Promise.resolve(u)),
    crear: vi.fn((u: Partial<Usuario>) => Promise.resolve(u)),
  };
  const alcance = { cargar: vi.fn(), sucursalesDe: vi.fn() };
  const archivos = { guardarFoto: vi.fn().mockResolvedValue({ id: 'nueva' }), eliminar: vi.fn() };
  const servicio = new UsuariosService(
    repo as unknown as UsuariosRepository,
    alcance as unknown as AlcanceService,
    archivos as unknown as ArchivosService,
  );
  return { servicio, repo, archivos };
}

describe('UsuariosService', () => {
  describe('obtenerGestionable (RF-01.4, P-49)', () => {
    it.each([
      ['el superusuario sobre un administrador', superusuario, usuario({ rol: 'ADMIN' })],
      ['el superusuario sobre un empleado de cualquier sucursal (P-48)', superusuario, usuario({ rol: 'EMPLEADO', sucursalId: 'Z' })],
      ['el administrador sobre un empleado de sus sucursales', adminA, usuario({ rol: 'EMPLEADO', sucursalId: 'A' })],
    ])('permite %s', async (_caso, actor, objetivo) => {
      const { servicio } = crear(objetivo);
      await expect(servicio.obtenerGestionable('x', actor)).resolves.toBe(objetivo);
    });

    it.each([
      ['un administrador sobre otro administrador', adminA, usuario({ rol: 'ADMIN' })],
      ['un administrador sobre un empleado fuera de sus sucursales', adminA, usuario({ rol: 'EMPLEADO', sucursalId: 'B' })],
      ['el superusuario sobre si mismo (RN-00.7)', superusuario, usuario({ rol: 'SUPERUSUARIO' })],
    ])('responde 404 para %s', async (_caso, actor, objetivo) => {
      const { servicio } = crear(objetivo);
      await expect(servicio.obtenerGestionable('x', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('crear', () => {
    it('guarda el hash, nunca la contrasena, y obliga a cambiarla (RF-01.2)', async () => {
      const { servicio, repo } = crear(null);
      await servicio.crear(
        { rol: 'ADMIN', nombres: 'Ana', apellidoPaterno: 'Ruiz', username: 'aruiz', passwordTemporal: 'Temporal1' },
        's1',
      );
      const guardado = repo.crear.mock.calls[0][0];
      expect(guardado).toMatchObject({ debeCambiarPassword: true, creadoPor: 's1', apellidoMaterno: null, sucursalId: null });
      expect(await bcrypt.compare('Temporal1', guardado.passwordHash!)).toBe(true);
    });

    it('el empleado nace sin usuario: entra con su numero de empleado (D-34)', async () => {
      const { servicio, repo } = crear(null);
      await servicio.crear(
        { rol: 'EMPLEADO', sucursalId: 'A', nombres: 'Luis', apellidoPaterno: 'Mora', passwordTemporal: 'Temporal1' },
        'a1',
      );
      expect(repo.crear.mock.calls[0][0]).toMatchObject({ rol: 'EMPLEADO', username: null, sucursalId: 'A' });
    });
  });

  describe('actualizarCuenta', () => {
    it('no le pone usuario a un empleado (D-34)', async () => {
      const objetivo = usuario({ rol: 'EMPLEADO', sucursalId: 'A', username: null });
      const { servicio } = crear(objetivo);
      const resultado = await servicio.actualizarCuenta('x', { username: 'lmora' }, superusuario);
      expect(resultado.username).toBeNull();
    });
  });

  describe('restablecerPassword (RF-01.4, RF-01.5)', () => {
    it('pide cambiarla, cierra las sesiones, desbloquea y registra quien lo hizo', async () => {
      const objetivo = usuario({ versionToken: 2, intentosFallidos: 3, bloqueadoHasta: new Date() });
      const { servicio } = crear(objetivo);

      const resultado = await servicio.restablecerPassword('x', 'Nueva1234', superusuario);

      expect(resultado).toMatchObject({
        debeCambiarPassword: true,
        versionToken: 3,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        actualizadoPor: 's1',
      });
      expect(await bcrypt.compare('Nueva1234', resultado.passwordHash)).toBe(true);
    });
  });

  describe('desactivar', () => {
    it('cierra las sesiones del usuario', async () => {
      const { servicio } = crear(usuario({ id: 'x', versionToken: 5 }));
      await expect(servicio.desactivar('x', superusuario)).resolves.toMatchObject({ activo: false, versionToken: 6 });
    });

    it('ya no exige un administrador activo por empresa (RN-01.3 retirada)', async () => {
      const { servicio } = crear(usuario({ id: 'x' }));
      await expect(servicio.desactivar('x', superusuario)).resolves.toHaveProperty('activo', false);
    });
  });

  describe('cambiarPropiaPassword', () => {
    const hash = bcrypt.hashSync('Actual123', 4);

    it('exige la contrasena actual correcta', async () => {
      const { servicio } = crear(usuario({ passwordHash: hash }));
      await expect(servicio.cambiarPropiaPassword('x', 'Otra1234', 'Nueva1234')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('no acepta la misma contrasena', async () => {
      const { servicio } = crear(usuario({ passwordHash: hash }));
      await expect(servicio.cambiarPropiaPassword('x', 'Actual123', 'Actual123')).rejects.toMatchObject({
        response: { code: 'PASSWORD_REPETIDA' },
      });
    });

    it('quita la marca de contrasena temporal y cierra las otras sesiones', async () => {
      const { servicio } = crear(usuario({ passwordHash: hash, debeCambiarPassword: true, versionToken: 1 }));
      const resultado = await servicio.cambiarPropiaPassword('x', 'Actual123', 'Nueva1234');
      expect(resultado).toMatchObject({ debeCambiarPassword: false, versionToken: 2, actualizadoPor: 'x' });
    });
  });

  describe('cambiarFoto', () => {
    it('reemplaza la foto y borra la anterior', async () => {
      const objetivo = usuario({ fotoArchivoId: 'vieja' });
      const { servicio, archivos } = crear(objetivo);

      await servicio.cambiarFoto(objetivo, {} as Express.Multer.File, 's1');

      expect(objetivo.fotoArchivoId).toBe('nueva');
      expect(archivos.eliminar).toHaveBeenCalledWith('vieja');
    });

    it('si no se puede guardar el usuario, borra la foto nueva y conserva la anterior', async () => {
      const objetivo = usuario({ fotoArchivoId: 'vieja' });
      const { servicio, repo, archivos } = crear(objetivo);
      repo.guardar.mockRejectedValueOnce(new Error('fallo'));

      await expect(servicio.cambiarFoto(objetivo, {} as Express.Multer.File, 's1')).rejects.toThrow('fallo');
      expect(archivos.eliminar).toHaveBeenCalledWith('nueva');
      expect(archivos.eliminar).not.toHaveBeenCalledWith('vieja');
    });
  });
});
