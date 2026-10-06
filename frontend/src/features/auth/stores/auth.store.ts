import { create } from 'zustand';
import { alDenegarPermiso, alExpirarSesion } from '../../../services/api/client';
import { authService } from '../services/auth.service';
import type { Perfil } from '../types/auth.types';

// verificando: todavia no se sabe si la cookie de sesion sigue valida
export type EstadoSesion = 'verificando' | 'sin-sesion' | 'con-sesion';

interface AuthState {
  usuario: Perfil | null;
  estado: EstadoSesion;
  verificarSesion: () => Promise<void>;
  iniciarSesion: (username: string, password: string) => Promise<Perfil>;
  iniciarSesionEmpleado: (empresaId: string, numeroEmpleado: string, password: string) => Promise<Perfil>;
  cambiarPassword: (passwordActual: string, passwordNueva: string) => Promise<Perfil>;
  cerrarSesion: () => Promise<void>;
  actualizarUsuario: (usuario: Perfil) => void;
}

// Solo guarda los datos de /auth/me; el token vive en una cookie httpOnly (T-05)
export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  estado: 'verificando',

  async verificarSesion() {
    try {
      const usuario = await authService.obtenerSesion();
      set({ usuario, estado: 'con-sesion' });
    } catch {
      set({ usuario: null, estado: 'sin-sesion' });
    }
  },

  async iniciarSesion(username, password) {
    const usuario = await authService.iniciarSesion(username, password);
    set({ usuario, estado: 'con-sesion' });
    return usuario;
  },

  async iniciarSesionEmpleado(empresaId, numeroEmpleado, password) {
    const usuario = await authService.iniciarSesionEmpleado(empresaId, numeroEmpleado, password);
    set({ usuario, estado: 'con-sesion' });
    return usuario;
  },

  async cambiarPassword(passwordActual, passwordNueva) {
    const usuario = await authService.cambiarPassword(passwordActual, passwordNueva);
    set({ usuario, estado: 'con-sesion' });
    return usuario;
  },

  async cerrarSesion() {
    try {
      await authService.cerrarSesion();
    } finally {
      set({ usuario: null, estado: 'sin-sesion' });
    }
  },

  actualizarUsuario(usuario) {
    set({ usuario });
  },
}));

// Un 401 en cualquier peticion significa que la sesion expiro o se cerro desde otro lugar
alExpirarSesion(() => useAuthStore.setState({ usuario: null, estado: 'sin-sesion' }));

// Refresca permisos y sucursales sin cerrar la sesion (RN-00.10)
alDenegarPermiso(() => {
  authService
    .obtenerSesion()
    .then((usuario) => useAuthStore.setState({ usuario }))
    .catch(() => undefined);
});
