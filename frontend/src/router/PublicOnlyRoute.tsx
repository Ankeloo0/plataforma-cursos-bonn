import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../features/auth/stores/auth.store';
import { rutaInicio } from '../utils/rutas';
import { PantallaVerificando } from './ProtectedRoute';

// El inicio de sesion no se muestra a quien ya tiene sesion
export function PublicOnlyRoute() {
  const { estado, usuario } = useAuthStore();
  if (estado === 'verificando') return <PantallaVerificando />;
  if (usuario) return <Navigate to={usuario.debeCambiarPassword ? '/cambiar-password' : rutaInicio(usuario.rol)} replace />;
  return <Outlet />;
}
