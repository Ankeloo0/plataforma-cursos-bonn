import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import { CursosAccesoService } from './cursos-acceso.service.js';

const acceso = new CursosAccesoService();
const superusuario = { id: 's1', rol: 'SUPERUSUARIO', permisos: [] } as unknown as UsuarioSesion;
const admin = (permisos: string[]) => ({ id: 'a1', rol: 'ADMIN', permisos }) as unknown as UsuarioSesion;

describe('CursosAccesoService (V-10, V-12 antes de los destinos)', () => {
  it('el superusuario ve y edita cualquier curso, y su listado no se filtra', () => {
    expect(acceso.puedeVer({ creadoPor: 'otro' }, superusuario)).toBe(true);
    expect(acceso.puedeEditar({ creadoPor: 'otro' }, superusuario)).toBe(true);
    expect(acceso.creadorVisible(superusuario)).toBeNull();
  });

  it('un administrador ve solo los cursos que creo', () => {
    const actor = admin(['CURSOS_GESTIONAR']);
    expect(acceso.creadorVisible(actor)).toBe('a1');
    expect(acceso.puedeVer({ creadoPor: 'a1' }, actor)).toBe(true);
    expect(acceso.puedeVer({ creadoPor: 'otro' }, actor)).toBe(false);
  });

  it('para editar, el administrador necesita ademas "Gestionar cursos"', () => {
    expect(acceso.puedeEditar({ creadoPor: 'a1' }, admin(['CURSOS_GESTIONAR']))).toBe(true);
    expect(acceso.puedeEditar({ creadoPor: 'a1' }, admin(['CURSOS_ASIGNAR']))).toBe(false);
    expect(acceso.puedeEditar({ creadoPor: 'otro' }, admin(['CURSOS_GESTIONAR']))).toBe(false);
  });
});
