import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import type { EmpresaDeUsuario, SucursalDeUsuario, UsuarioConSucursal } from '../usuarios/usuarios.repository.js';
import type { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthService } from './auth.service.js';

const HASH = bcrypt.hashSync('Correcta123', 4);

function usuario(datos: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    rol: 'ADMIN',
    sucursalId: null,
    empresaId: 'e1',
    numeroEmpleado: '1024',
    passwordHash: HASH,
    activo: true,
    versionToken: 3,
    debeCambiarPassword: false,
    bloqueadoHasta: null,
    ...datos,
  } as Usuario;
}

function empresa(activo = true): EmpresaDeUsuario {
  return { id: 'e1', nombre: 'Grupo Bonn', activo };
}

function sucursal(activo = true): SucursalDeUsuario {
  return { id: 's1', nombre: 'VW Bonn Oaxaca', activo, empresa: empresa(), marca: { id: 'm1', nombre: 'Volkswagen' } };
}

//administrador o superusuario: sin sucursal
function cuenta(datos: Partial<Usuario> = {}, empresaActiva = true): UsuarioConSucursal {
  return { usuario: usuario(datos), empresa: empresa(empresaActiva), sucursal: null };
}

function cuentaEmpleado(datos: Partial<Usuario> = {}, sucursalActiva = true, empresaActiva = true): UsuarioConSucursal {
  return { usuario: empleado(datos), empresa: empresa(empresaActiva), sucursal: sucursal(sucursalActiva) };
}

function empleado(datos: Partial<Usuario> = {}): Usuario {
  return usuario({ rol: 'EMPLEADO', sucursalId: 's1', ...datos });
}

function crear(encontrado: UsuarioConSucursal | null) {
  const usuarios = {
    buscarParaLogin: vi.fn().mockResolvedValue(encontrado),
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
  it('busca la cuenta por empresa y numero, firma un token con la version y reinicia los intentos', async () => {
    const { servicio, usuarios, jwt } = crear(cuenta());

    const sesion = await servicio.login('e1', '1024', 'Correcta123');

    expect(usuarios.buscarParaLogin).toHaveBeenCalledWith('e1', '1024');
    const payload = jwt.decode(sesion.token);
    expect(payload).toMatchObject({ sub: 'u1', ver: 3 });
    expect(payload).not.toHaveProperty('rol');
    expect(sesion.expiraEn.getTime()).toBeGreaterThan(Date.now() + 7 * 3600_000);
    expect(usuarios.registrarAccesoExitoso).toHaveBeenCalledWith('u1');
  });

  it('los tres roles entran por el mismo acceso', async () => {
    await expect(crear(cuenta({ rol: 'SUPERUSUARIO' })).servicio.login('e1', '1', 'Correcta123')).resolves.toHaveProperty('token');
    await expect(crear(cuenta()).servicio.login('e1', '1024', 'Correcta123')).resolves.toHaveProperty('token');
    await expect(crear(cuentaEmpleado()).servicio.login('e1', '1234', 'Correcta123')).resolves.toHaveProperty('token');
  });

  it('da el mismo mensaje si el numero no existe en la empresa o si la contrasena falla (RN-01.6)', async () => {
    const noExiste = await errorDe(crear(null).servicio.login('e1', '9999', 'Correcta123'));
    const { servicio, usuarios } = crear(cuenta());
    const malaPassword = await errorDe(servicio.login('e1', '1024', 'Incorrecta1'));

    expect(noExiste).toBeInstanceOf(UnauthorizedException);
    expect(noExiste.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS', message: expect.stringMatching(/número de empleado/) });
    expect(malaPassword.getResponse()).toEqual(noExiste.getResponse());
    expect(usuarios.registrarIntentoFallido).toHaveBeenCalledWith('u1', 5, 15);
  });

  it('rechaza una cuenta bloqueada con 429 aunque la contrasena sea correcta (RN-01.7)', async () => {
    const bloqueadoHasta = new Date(Date.now() + 60_000);
    const { servicio, usuarios } = crear(cuentaEmpleado({ bloqueadoHasta }));

    const error = await errorDe(servicio.login('e1', '1234', 'Correcta123'));

    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({ code: 'CUENTA_BLOQUEADA', message: expect.stringMatching(/1 minuto /) });
    expect(usuarios.registrarAccesoExitoso).not.toHaveBeenCalled();
  });

  it('permite entrar cuando el bloqueo ya paso', async () => {
    const bloqueadoHasta = new Date(Date.now() - 1000);
    await expect(crear(cuenta({ bloqueadoHasta })).servicio.login('e1', '1024', 'Correcta123')).resolves.toHaveProperty('token');
  });

  it('rechaza con el mensaje generico una cuenta inactiva (RN-01.2)', async () => {
    const error = await errorDe(crear(cuenta({ activo: false })).servicio.login('e1', '1024', 'Correcta123'));
    expect(error.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
  });

  it('con la empresa inactiva no entra nadie registrado en ella (RN-00.3)', async () => {
    const administrador = await errorDe(crear(cuenta({}, false)).servicio.login('e1', '1024', 'Correcta123'));
    const deEmpleado = await errorDe(crear(cuentaEmpleado({}, true, false)).servicio.login('e1', '1234', 'Correcta123'));
    expect(administrador.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
    expect(deEmpleado.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
  });

  it('la sucursal inactiva solo bloquea al empleado (RN-00.8)', async () => {
    const error = await errorDe(crear(cuentaEmpleado({}, false)).servicio.login('e1', '1234', 'Correcta123'));
    expect(error.getResponse()).toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
  });
});

describe('AuthService.validarSesion', () => {
  const payload = { sub: 'u1', ver: 3 };

  it('devuelve el usuario con los permisos y las sucursales leidos de la base (T-22)', async () => {
    const { servicio } = crear(cuenta({ debeCambiarPassword: true }));
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
    const { servicio } = crear(cuenta({ versionToken: 4 }));
    await expect(servicio.validarSesion(payload)).resolves.toBeNull();
  });

  it('invalida la sesion si se desactivo la cuenta, su empresa o la sucursal del empleado', async () => {
    await expect(crear(cuenta({ activo: false })).servicio.validarSesion(payload)).resolves.toBeNull();
    await expect(crear(cuenta({}, false)).servicio.validarSesion(payload)).resolves.toBeNull();
    await expect(crear(cuentaEmpleado({}, false)).servicio.validarSesion(payload)).resolves.toBeNull();
  });
});
