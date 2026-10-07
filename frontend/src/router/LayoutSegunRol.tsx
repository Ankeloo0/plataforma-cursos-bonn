import { useAuthStore } from '../features/auth/stores/auth.store';
import { EmpleadoLayout } from '../layouts/EmpleadoLayout';
import { PanelLayout } from '../layouts/PanelLayout';

// Rutas que comparten los tres roles (por ahora /perfil): el empleado las ve con su navegacion superior
export function LayoutSegunRol() {
  const rol = useAuthStore((s) => s.usuario?.rol);
  return rol === 'EMPLEADO' ? <EmpleadoLayout /> : <PanelLayout />;
}
