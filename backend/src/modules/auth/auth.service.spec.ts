import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import type { SucursalDeUsuario } from '../usuarios/usuarios.repository.js';
import type { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthService } from './auth.service.js';

const HASH = bcrypt.hashSync('Correcta123', 4);

function usuario(datos: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    rol: 'ADMIN',
    sucursalId: null,
    passwordHash: HASH,
    activo: true,
    versionToken: 3,
    debeCambiarPassword: false,
    bloqueadoHasta: null,
    ...datos,
  } as Usuario;
}

function sucursal(activo = true, empresaActiva = true): SucursalDeUsuario {
  return {
    id: 's1',
    nombre: 'VW Bonn Oaxaca',
    activo,
    empresa: { id: 'e1', nombre: 'Grupo Bonn', activo: empresaActiva },
    marca: { id: 'm1', nombre: 'Volkswagen' },
  };
}

function empleado(datos: Partial<Usuario> = {}): Usuario {
  return usuario({ rol: 'EMPLEADO', sucursalId: 's1', ...datos });
}

function crear(encontrado: { usuario: Usuario; sucursal: SucursalDeUsuario | null } | null) {
  const usuarios = {
    buscarParaLogin: vi.fn().mockResolvedValue(encontrado),
    buscarEmpleadoParaLogin: vi.fn().mockResolvedValue(encontrado),
    buscarConSucursal: vi.fn().mockResolvedValue(encontrado),
    registrarIntentoFallido: vi.fn(),
    registrarAccesoExitoso: vi.fn(),
  };
  const alcance = {
    cargar: vi.fn().mockResolvedValue({ permisos: ['REPORTES_VER'], alcance: { sinLimite: false, sucursalIds: ['s1'] } }),
  };
  const config = { get: (clave: string) => ({ 'auth.loginMaxIntentos': 5, 'auth.loginBloqueoMinutos': 15 })[clave] };
  const jwt = new JwtService({ secret: 'secreto-de-pruebas-de-al-menos-32-caracteres', signOptions: { expiresIn: '8h' } });
  const servicio = new AuthService(
    usuarios as unknown as UsuariosService,
    alcance as unknown as AlcanceService,
    jwt,
    config as unknown as ConfigService,
  );
  return { servicio, usuarios, jwt };
}

async function errorDe(promesa: Promise<unknown>): Promise<HttpException> {
  try {
    await promesa;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('Se esperaba un error');
}

describe('AuthService.login', () => {
  it('con credenciales correctas firma un token con la version y reinicia los intentos', async () => {
    const { servicio, usuarios, jwt } = crear({ usuario: usuario(), sucursal: null });

    const sesion = await servicio.login('admin', 'Correcta123');

    const payload = jwt.decode(sesion.token);
    expect(payload).toMatchObject({ sub: 'u1', ver: 3 });
    expect(payload).not.toHaveProperty('rol');
    expect(sesion.expiraEn.getTime()).toBeGreaterThan(Date.now() + 7 * 3600_000);
    expect(usuarios.registrarAccesoExitoso).toHaveBeenCalledWith('u1');
  });

  it('da el mismo mensaje si el usuario no existe o si la contrasena falla (RN-01.6)', async () => {
    const noExiste = await errorDe(crear(null).servicio.login('nadie', 'Correcta123'));
    const { servicio, usuarios } = crear({ usuario: usuario(), sucursal: null });
    const malaPassword = await errorDe(servicio.login('admin', 'Incorrecta1'));

    expect(noExiste).toBeInstanceOf(UnauthorizedException);
    expect(malaPassword.getResponse()).toEqual(noExiste.getResponse());
    expect(usuarios.registrarIntentoFallido).toHaveBeenCalledWith('u1', 5, 15);
  });

  it('rechaza una cuenta bloqueada con 429 aunque la contrasena sea correcta (RN-01.7)', async () => {
    const bloqueadoHasta = new Date(Date.now() + 10 * 60_000);
    const { servicio, usuarios } = crear({ usuario: usuario({ bloqueadoHasta }), sucursal: null });

    const error = await errorDe(servicio.login('admin', 'Correcta123'));

    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({ code: 'CUENTA_BLOQUEADA' });
    expect(usuarios.registrarAccesoExitoso).not.toHaveBeenCalled();
  });

  it('permite entrar cuando el bloqueo ya paso', async () => {
    const bloqueadoHasta = new Date(Date.now() - 1000);
    const { servicio } = crear({ usuario: usuario({ bloqueadoHasta }), sucursal: null });
    await expect(servicio.login('admin', 'Correcta123')).resolves.toHaveProperty('token');
  });

  it('rechaza con el mensaje generico una cuenta inactiva (RN-01.2)', async () => {
    const error = await errorDe(crear({ usuario: usuario({ activo: false }), sucursal: null }).servicio.login('admin', 'Correcta123'));
    expect(error.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
  });

  it('el superusuario, sin sucursal, puede entrar', async () => {
    const { servicio } = crear({ usuario: usuario({ rol: 'SUPERUSUARIO' }), sucursal: null });
    await expect(servicio.login('super', 'Correcta123')).resolves.toHaveProperty('token');
  });
});

describe('AuthService.loginEmpleado', () => {
  it('busca al empleado por su empresa y su numero, y firma el token (D-34)', async () => {
    const { servicio, usuarios, jwt } = crear({ usuario: empleado(), sucursal: sucursal() });

    const sesion = await servicio.loginEmpleado('e1', '1234', 'Correcta123');

    expect(usuarios.buscarEmpleadoParaLogin).toHaveBeenCalledWith('e1', '1234');
    expect(usuarios.buscarParaLogin).not.toHaveBeenCalled();
    expect(jwt.decode(sesion.token)).toMatchObject({ sub: 'u1', ver: 3 });
    expect(usuarios.registrarAccesoExitoso).toHaveBeenCalledWith('u1');
  });

  it('da el mismo mensaje si el numero no existe en la empresa o si la contrasena falla (RN-01.6)', async () => {
    const noExiste = await errorDe(crear(null).servicio.loginEmpleado('e1', '9999', 'Correcta123'));
    const { servicio, usuarios } = crear({ usuario: empleado(), sucursal: sucursal() });
    const malaPassword = await errorDe(servicio.loginEmpleado('e1', '1234', 'Incorrecta1'));

    expect(noExiste).toBeInstanceOf(UnauthorizedException);
    expect(noExiste.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS', message: expect.stringMatching(/número de empleado/) });
    expect(malaPassword.getResponse()).toEqual(noExiste.getResponse());
    expect(usuarios.registrarIntentoFallido).toHaveBeenCalledWith('u1', 5, 15);
  });

  it('bloquea al empleado tras los intentos fallidos igual que a un administrador (RN-01.7)', async () => {
    const bloqueadoHasta = new Date(Date.now() + 60_000);
    const error = await errorDe(
      crear({ usuario: empleado({ bloqueadoHasta }), sucursal: sucursal() }).servicio.loginEmpleado('e1', '1234', 'Correcta123'),
    );
    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({ code: 'CUENTA_BLOQUEADA', message: expect.stringMatching(/1 minuto /) });
  });

  it('rechaza a un empleado de una sucursal o empresa inactiva; con ambas activas entra (RN-00.3, RN-00.8)', async () => {
    const sucursalInactiva = await errorDe(
      crear({ usuario: empleado(), sucursal: sucursal(false) }).servicio.loginEmpleado('e1', '1234', 'Correcta123'),
    );
    const empresaInactiva = await errorDe(
      crear({ usuario: empleado(), sucursal: sucursal(true, false) }).servicio.loginEmpleado('e1', '1234', 'Correcta123'),
    );
    expect(sucursalInactiva.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
    expect(empresaInactiva.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
    await expect(
      crear({ usuario: empleado(), sucursal: sucursal() }).servicio.loginEmpleado('e1', '1234', 'Correcta123'),
    ).resolves.toHaveProperty('token');
  });
});

describe('AuthService.validarSesion', () => {
  const payload = { sub: 'u1', ver: 3 };

  it('devuelve el usuario con los permisos y las sucursales leidos de la base (T-22)', async () => {
    const { servicio } = crear({ usuario: usuario({ debeCambiarPassword: true }), sucursal: null });
    await expect(servicio.validarSesion(payload)).resolves.toEqual({
      id: 'u1',
      rol: 'ADMIN',
      debeCambiarPassword: true,
      permisos: ['REPORTES_VER'],
      alcance: { sinLimite: false, sucursalIds: ['s1'] },
      sucursalId: null,
    });
  });

  it('invalida el token si cambio version_token (sesiones cerradas, RF-01.5)', async () => {
    const { servicio } = crear({ usuario: usuario({ versionToken: 4 }), sucursal: null });
    await expect(servicio.validarSesion(payload)).resolves.toBeNull();
  });

  it('invalida la sesion si la cuenta se desactivo, o la sucursal del empleado', async () => {
    await expect(crear({ usuario: usuario({ activo: false }), sucursal: null }).servicio.validarSesion(payload)).resolves.toBeNull();
    await expect(
      crear({ usuario: empleado(), sucursal: sucursal(false) }).servicio.validarSesion(payload),
    ).resolves.toBeNull();
  });
});
