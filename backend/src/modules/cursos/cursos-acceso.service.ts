import { Injectable } from '@nestjs/common';
import { PERMISOS } from '../../common/constants/permisos.js';
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
    if (actor.rol === ROLES.SUPERUSUARIO) return true;
    return curso.creadoPor === actor.id && actor.permisos.includes(PERMISOS.CURSOS_GESTIONAR);
  }
}
