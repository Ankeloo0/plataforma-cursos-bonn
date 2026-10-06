import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../features/auth/stores/auth.store';
import type { Permiso, Rol } from '../features/auth/types/auth.types';
import { puede } from '../utils/permisos';
import { rutaInicio } from '../utils/rutas';

// Comodidad y orden, no seguridad: la API vuelve a autorizar cada peticion (RN-00.1)
export function RoleRoute({ roles, permisos }: { roles: Rol[]; permisos?: Permiso[] }) {
  const usuario = useAuthStore((s) => s.usuario);
  if (!usuario) return <Navigate to="/login" replace />;
  if (!roles.includes(usuario.rol)) return <Navigate to={rutaInicio(usuario.rol)} replace />;
  if (permisos && !puede(usuario, ...permisos)) return <Navigate to={rutaInicio(usuario.rol)} replace />;
  return <Outlet />;
}
