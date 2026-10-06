import { useAuthStore } from '../features/auth/stores/auth.store';
import type { Perfil } from '../features/auth/types/auth.types';

export function perfil(datos: Partial<Perfil> = {}): Perfil {
  return {
    id: 'u1',
    username: 'jperez',
    rol: 'ADMIN',
    nombres: 'Juan',
    apellidoPaterno: 'Pérez',
    apellidoMaterno: null,
    fotoUrl: null,
    debeCambiarPassword: false,
    ultimoAccesoEn: null,
    permisos: [],
    sucursales: [
      { id: 's1', nombre: 'Sucursal Centro', empresa: { id: 'e1', nombre: 'Grupo Centro' }, marca: { id: 'm1', nombre: 'Volkswagen' } },
    ],
    sucursal: null,
    ...datos,
  };
}

export function conSesion(datos: Partial<Perfil> = {}): void {
  useAuthStore.setState({ usuario: perfil(datos), estado: 'con-sesion' });
}

export function sinSesion(): void {
  useAuthStore.setState({ usuario: null, estado: 'sin-sesion' });
}
