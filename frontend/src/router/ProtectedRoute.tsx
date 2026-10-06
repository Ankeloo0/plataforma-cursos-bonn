import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../features/auth/stores/auth.store';

// Requiere sesion. Con contrasena temporal solo deja entrar a /cambiar-password (RF-01.2).
export function ProtectedRoute() {
  const { estado, usuario } = useAuthStore();
  const ubicacion = useLocation();

  if (estado === 'verificando') return <PantallaVerificando />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  if (usuario.debeCambiarPassword && ubicacion.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />;
  }
  return <Outlet />;
}

// Mientras se confirma la sesion no se pinta nada: evita que el formulario aparezca y desaparezca
export function PantallaVerificando() {
  return <div aria-busy="true" aria-label="Cargando" style={{ minHeight: '100dvh' }} />;
}
