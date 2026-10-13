import { Injectable } from '@nestjs/common';
import { PERMISOS, type Permiso } from '../../common/constants/permisos.js';
import { ROLES } from '../../common/constants/roles.js';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import type { Curso } from './entities/curso.entity.js';

// Quien ve y quien edita un curso (V-10, V-12, technical-spec 4.9).
// Mientras no existen los destinos (I4), un administrador solo ve y edita los cursos que creo.
// En I4 se agregan los cursos que llegan a sus sucursales y los editables por sus destinos.
@Injectable()
export class CursosAccesoService {
  // Para filtrar el listado: null = todos los cursos
  creadorVisible(actor: UsuarioSesion): string | null {
    return actor.rol === ROLES.SUPERUSUARIO ? null : actor.id;
  }

  puedeVer(curso: Pick<Curso, 'creadoPor'>, actor: UsuarioSesion): boolean {
    return actor.rol === ROLES.SUPERUSUARIO || curso.creadoPor === actor.id;
  }

  // Ademas de ver el curso, el administrador necesita "Gestionar cursos"
  puedeEditar(curso: Pick<Curso, 'creadoPor'>, actor: UsuarioSesion): boolean {
    return this.leToca(curso, actor, PERMISOS.CURSOS_GESTIONAR);
  }

  //publicar y reactivar: el administrador ademas necesita un destino de sus sucursales,
  //y los cursos todavia no tienen destinos, asi que por ahora solo el superusuario
  puedePublicar(_curso: Pick<Curso, 'creadoPor'>, actor: UsuarioSesion): boolean {
    return actor.rol === ROLES.SUPERUSUARIO;
  }

  puedeArchivar(curso: Pick<Curso, 'creadoPor'>, actor: UsuarioSesion): boolean {
    return this.leToca(curso, actor, PERMISOS.CURSOS_PUBLICAR);
  }

  private leToca(curso: Pick<Curso, 'creadoPor'>, actor: UsuarioSesion, permiso: Permiso): boolean {
    if (actor.rol === ROLES.SUPERUSUARIO) return true;
    return curso.creadoPor === actor.id && actor.permisos.includes(permiso);
  }
}
