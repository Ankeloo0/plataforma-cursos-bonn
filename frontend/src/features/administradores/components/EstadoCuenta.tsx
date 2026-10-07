import { CircleCheck, CircleMinus, KeyRound, Lock } from 'lucide-react';
import { Chip } from '../../../components/ui/Chip';
import { hora } from '../../../utils/formato';
import type { Administrador } from '../types/administradores.types';

// Un solo chip con el estado que mas importa de la cuenta (administradores y empleados)
export function EstadoCuenta({ cuenta }: { cuenta: Pick<Administrador, 'activo' | 'bloqueadoHasta' | 'debeCambiarPassword'> }) {
  if (!cuenta.activo) return <Chip icono={CircleMinus}>Inactivo</Chip>;
  if (cuenta.bloqueadoHasta) {
    return (
      <Chip tono="critico" icono={Lock}>
        Bloqueado hasta {hora(cuenta.bloqueadoHasta)}
      </Chip>
    );
  }
  if (cuenta.debeCambiarPassword) {
    return (
      <Chip tono="aviso" icono={KeyRound}>
        Debe crear su contraseña
      </Chip>
    );
  }
  return (
    <Chip tono="exito" icono={CircleCheck}>
      Activo
    </Chip>
  );
}
