import { Navigate } from 'react-router';
import { useAuthStore } from '../features/auth/stores/auth.store';
import { InicioAdminPage } from '../features/inicio/pages/InicioAdminPage';

// /panel: el administrador ve su inicio; el superusuario, mientras no exista su dashboard (I7), las empresas
export function InicioPanel() {
  const rol = useAuthStore((s) => s.usuario?.rol);
  return rol === 'SUPERUSUARIO' ? <Navigate to="/empresas" replace /> : <InicioAdminPage />;
}
