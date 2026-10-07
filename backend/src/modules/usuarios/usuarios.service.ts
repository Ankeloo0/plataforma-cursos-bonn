import { Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import bcrypt from 'bcrypt';
import { ROLES, type Rol } from '../../common/constants/roles.js';
import { BCRYPT_COSTO } from '../../common/constants/seguridad.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { ArchivosService } from '../archivos/archivos.service.js';
import { alcanceIncluye, AlcanceService } from './alcance.service.js';
import type { ActualizarCuentaDto, CrearCuentaDto } from './dto/datos-cuenta.dto.js';
import { PerfilResponseDto } from './dto/perfil-response.dto.js';
import type { Usuario } from './entities/usuario.entity.js';
import {
  UsuariosRepository,
  type AdministradorConResumen,
  type FiltrosAdministradores,
  type UsuarioConSucursal,
} from './usuarios.repository.js';

// El empleado no tiene usuario: entra con su empresa y su numero de empleado (D-34)
export type DatosNuevoUsuario = Omit<CrearCuentaDto, 'username'> &
  (
    | { rol: typeof ROLES.ADMIN; username: string; sucursalId?: undefined }
    | { rol: typeof ROLES.EMPLEADO; sucursalId: string; username?: undefined }
  );

const USUARIO_NO_ENCONTRADO = { message: 'El usuario no existe.', code: 'USUARIO_NO_ENCONTRADO' };

@Injectable()
export class UsuariosService {
  constructor(
    private readonly usuariosRepository: UsuariosRepository,
    private readonly alcanceService: AlcanceService,
    private readonly archivosService: ArchivosService,
  ) {}

  async crear(datos: DatosNuevoUsuario, creadoPor: string, manager?: EntityManager): Promise<Usuario> {
    return this.usuariosRepository.crear({
      rol: datos.rol,
      sucursalId: datos.sucursalId ?? null,
      username: datos.username ?? null,
      passwordHash: await bcrypt.hash(datos.passwordTemporal, BCRYPT_COSTO),
      nombres: datos.nombres,
      apellidoPaterno: datos.apellidoPaterno,
      apellidoMaterno: datos.apellidoMaterno ?? null,
      debeCambiarPassword: true,
      creadoPor,
    }, manager);
  }

  guardar(usuario: Usuario, manager?: EntityManager): Promise<Usuario> {
    return this.usuariosRepository.guardar(usuario, manager);
  }

  buscarParaLogin(username: string): Promise<UsuarioConSucursal | null> {
    return this.usuariosRepository.buscarPorUsernameConSucursal(username);
  }

  buscarEmpleadoParaLogin(empresaId: string, numeroEmpleado: string): Promise<UsuarioConSucursal | null> {
    return this.usuariosRepository.buscarEmpleadoParaLogin(empresaId, numeroEmpleado);
  }

  buscarConSucursal(id: string): Promise<UsuarioConSucursal | null> {
    return this.usuariosRepository.buscarPorIdConSucursal(id);
  }

  registrarIntentoFallido(id: string, maxIntentos: number, minutosBloqueo: number): Promise<void> {
    return this.usuariosRepository.registrarIntentoFallido(id, maxIntentos, minutosBloqueo);
  }

  registrarAccesoExitoso(id: string): Promise<void> {
    return this.usuariosRepository.registrarAccesoExitoso(id);
  }

  async obtenerPerfil(id: string): Promise<PerfilResponseDto> {
    const encontrado = await this.usuariosRepository.buscarPorIdConSucursal(id);
    if (!encontrado) throw new NotFoundException(USUARIO_NO_ENCONTRADO);
    const { permisos } = await this.alcanceService.cargar(encontrado.usuario);
    const sucursales = encontrado.usuario.rol === ROLES.ADMIN ? await this.alcanceService.sucursalesDe(id) : [];
    const laborales = encontrado.usuario.rol === ROLES.EMPLEADO ? await this.usuariosRepository.datosLaboralesDe(id) : null;
    return PerfilResponseDto.desde(encontrado, permisos, sucursales, laborales);
  }

  // RF-01.2 y RF-01.3. Cambiar la contrasena cierra las demas sesiones del usuario.
  async cambiarPropiaPassword(id: string, actual: string, nueva: string): Promise<Usuario> {
    const usuario = await this.usuariosRepository.buscarPorId(id);
    if (!usuario) {
      throw new UnauthorizedException({ message: 'Inicia sesión para continuar.', code: 'SESION_REQUERIDA' });
    }
    if (!(await bcrypt.compare(actual, usuario.passwordHash))) {
      throw new UnprocessableEntityException({
        message: 'La contraseña actual no es correcta.',
        code: 'PASSWORD_ACTUAL_INCORRECTA',
      });
    }
    if (actual === nueva) {
      throw new UnprocessableEntityException({
        message: 'La nueva contraseña debe ser distinta de la actual.',
        code: 'PASSWORD_REPETIDA',
      });
    }

    usuario.passwordHash = await bcrypt.hash(nueva, BCRYPT_COSTO);
    usuario.debeCambiarPassword = false;
    usuario.versionToken += 1;
    usuario.actualizadoPor = id;
    return this.usuariosRepository.guardar(usuario);
  }

  listarAdministradores(filtros: FiltrosAdministradores): Promise<{ administradores: AdministradorConResumen[]; total: number }> {
    return this.usuariosRepository.listarAdministradores(filtros);
  }

  async obtenerAdministrador(id: string): Promise<Usuario> {
    const usuario = await this.usuariosRepository.buscarPorId(id);
    if (!usuario || usuario.rol !== ROLES.ADMIN) throw new NotFoundException(USUARIO_NO_ENCONTRADO);
    return usuario;
  }

  // El superusuario gestiona administradores y empleados (P-48); el administrador, solo empleados
  // de sus sucursales (P-49). Cualquier otro caso responde 404 para no revelar que el usuario existe.
  async obtenerGestionable(id: string, actor: UsuarioSesion): Promise<Usuario> {
    const usuario = await this.usuariosRepository.buscarPorId(id);
    if (!usuario || !esGestionable(usuario, actor)) throw new NotFoundException(USUARIO_NO_ENCONTRADO);
    return usuario;
  }

  async actualizarCuenta(id: string, datos: ActualizarCuentaDto, actor: UsuarioSesion): Promise<Usuario> {
    const usuario = await this.obtenerGestionable(id, actor);
    if (datos.nombres !== undefined) usuario.nombres = datos.nombres;
    if (datos.apellidoPaterno !== undefined) usuario.apellidoPaterno = datos.apellidoPaterno;
    if (datos.apellidoMaterno !== undefined) usuario.apellidoMaterno = datos.apellidoMaterno;
    if (datos.username !== undefined && usuario.rol !== ROLES.EMPLEADO) usuario.username = datos.username;
    usuario.actualizadoPor = actor.id;
    return this.usuariosRepository.guardar(usuario);
  }

  // RF-01.4 y RF-01.5: nueva contrasena temporal y cierre de todas sus sesiones
  async restablecerPassword(id: string, passwordTemporal: string, actor: UsuarioSesion): Promise<Usuario> {
    const usuario = await this.obtenerGestionable(id, actor);
    usuario.passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_COSTO);
    usuario.debeCambiarPassword = true;
    usuario.versionToken += 1;
    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    usuario.actualizadoPor = actor.id;
    return this.usuariosRepository.guardar(usuario);
  }

  async activar(id: string, actor: UsuarioSesion): Promise<Usuario> {
    const usuario = await this.obtenerGestionable(id, actor);
    if (usuario.activo) return usuario;
    usuario.activo = true;
    usuario.actualizadoPor = actor.id;
    return this.usuariosRepository.guardar(usuario);
  }

  // Ya no se exige un administrador activo por empresa (RN-01.3 retirada en v0.4)
  async desactivar(id: string, actor: UsuarioSesion): Promise<Usuario> {
    const usuario = await this.obtenerGestionable(id, actor);
    if (!usuario.activo) return usuario;
    usuario.activo = false;
    usuario.versionToken += 1;
    usuario.actualizadoPor = actor.id;
    return this.usuariosRepository.guardar(usuario);
  }

  async desbloquear(id: string, actor: UsuarioSesion): Promise<Usuario> {
    const usuario = await this.obtenerGestionable(id, actor);
    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    usuario.actualizadoPor = actor.id;
    return this.usuariosRepository.guardar(usuario);
  }

  async cambiarFoto(usuario: Usuario, archivo: Express.Multer.File | undefined, actorId: string): Promise<Usuario> {
    const nueva = await this.archivosService.guardarFoto(archivo, actorId);
    const anterior = usuario.fotoArchivoId;

    usuario.fotoArchivoId = nueva.id;
    usuario.actualizadoPor = actorId;
    try {
      await this.usuariosRepository.guardar(usuario);
    } catch (error) {
      await this.archivosService.eliminar(nueva.id);
      throw error;
    }

    if (anterior) await this.archivosService.eliminar(anterior);
    return usuario;
  }

  async quitarFoto(usuario: Usuario, actorId: string): Promise<Usuario> {
    const anterior = usuario.fotoArchivoId;
    if (!anterior) return usuario;

    usuario.fotoArchivoId = null;
    usuario.actualizadoPor = actorId;
    await this.usuariosRepository.guardar(usuario);
    await this.archivosService.eliminar(anterior);
    return usuario;
  }

  async obtenerPropio(id: string): Promise<Usuario> {
    const usuario = await this.usuariosRepository.buscarPorId(id);
    if (!usuario) throw new NotFoundException(USUARIO_NO_ENCONTRADO);
    return usuario;
  }
}

function esGestionable(usuario: Usuario, actor: UsuarioSesion): boolean {
  const roles: Rol[] = actor.rol === ROLES.SUPERUSUARIO ? [ROLES.ADMIN, ROLES.EMPLEADO] : [ROLES.EMPLEADO];
  if (!roles.includes(usuario.rol)) return false;
  return usuario.rol === ROLES.ADMIN || alcanceIncluye(actor.alcance, usuario.sucursalId);
}
