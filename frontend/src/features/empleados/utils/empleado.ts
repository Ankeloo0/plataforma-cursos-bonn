import { IdCard, KeyRound, LockOpen, Pencil, Power, PowerOff } from 'lucide-react';
import type { Accion } from '../../../components/ui/MenuAcciones';
import { mostrarToast } from '../../../components/ui/toast.store';
import type { ApiError } from '../../../services/api/client';
import { puede } from '../../../utils/permisos';
import type { Perfil } from '../../auth/types/auth.types';
import { empleadosService } from '../services/empleados.service';
import type { Empleado } from '../types/empleados.types';

export type AccionEmpleado =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; empleado: Empleado }
  | { tipo: 'restablecer'; empleado: Empleado }
  | { tipo: 'desactivar'; empleado: Empleado }
  | null;

export const nombreEmpleado = (e: Pick<Empleado, 'nombres' | 'apellidoPaterno' | 'apellidoMaterno'>) =>
  [e.nombres, e.apellidoPaterno, e.apellidoMaterno].filter(Boolean).join(' ');

// Acciones del menu de un empleado segun los permisos de quien lo ve. Activar y desbloquear no
// piden confirmacion; desactivar si, porque cierra sus sesiones.
export function accionesDeEmpleado(
  empleado: Empleado,
  usuario: Perfil | null,
  abrir: (accion: AccionEmpleado) => void,
  alCambiar: () => void,
  // En el listado se agrega "Ver ficha"; en la ficha, "Editar" ya es un boton
  opciones: { verFicha?: () => void; editar?: boolean } = {},
): Accion[] {
  const { verFicha, editar = true } = opciones;
  const gestionar = puede(usuario, 'EMPLEADOS_GESTIONAR');
  const restablecer = puede(usuario, 'EMPLEADOS_RESTABLECER_PASSWORD');
  const directa = async (accion: () => Promise<void>, mensaje: string) => {
    try {
      await accion();
      alCambiar();
      mostrarToast(mensaje);
    } catch (error) {
      mostrarToast((error as ApiError).message, 'critico');
    }
  };

  const acciones: Accion[] = [];
  if (verFicha) acciones.push({ etiqueta: 'Ver ficha', icono: IdCard, alElegir: verFicha });
  if (gestionar && editar) acciones.push({ etiqueta: 'Editar', icono: Pencil, alElegir: () => abrir({ tipo: 'editar', empleado }) });
  if (restablecer) {
    acciones.push({ etiqueta: 'Restablecer contraseña', icono: KeyRound, alElegir: () => abrir({ tipo: 'restablecer', empleado }) });
    if (empleado.bloqueadoHasta) {
      acciones.push({
        etiqueta: 'Desbloquear',
        icono: LockOpen,
        alElegir: () => directa(() => empleadosService.desbloquear(empleado.usuarioId), 'Cuenta desbloqueada'),
      });
    }
  }
  if (gestionar) {
    acciones.push(
      empleado.activo
        ? { etiqueta: 'Dar de baja', icono: PowerOff, peligro: true, alElegir: () => abrir({ tipo: 'desactivar', empleado }) }
        : {
            etiqueta: 'Reactivar',
            icono: Power,
            alElegir: () => directa(() => empleadosService.cambiarEstado(empleado.usuarioId, true), 'Empleado reactivado'),
          },
    );
  }
  return acciones;
}
