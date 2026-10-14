import { useLocation, useNavigate } from 'react-router';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { rutaInicio } from '../../../utils/rutas';
import { FormularioLogin } from '../components/FormularioLogin';
import type { Perfil } from '../types/auth.types';
import styles from './AuthPages.module.css';

// Un solo acceso para empleados, administradores y superusuario: empresa, numero de empleado y contrasena
export function LoginPage() {
  const navigate = useNavigate();
  const ubicacion = useLocation();

  function alEntrar(usuario: Perfil) {
    const desde = (ubicacion.state as { desde?: string } | null)?.desde;
    if (usuario.debeCambiarPassword) navigate('/cambiar-password', { replace: true });
    else navigate(desde ?? rutaInicio(usuario.rol), { replace: true });
  }

  return (
    <AuthLayout>
      <h1 className={styles.titulo}>Te damos la bienvenida</h1>
      <p className={styles.bajada}>Ingresa con tu empresa, tu número de empleado y tu contraseña.</p>

      <FormularioLogin alEntrar={alEntrar} />

      <p className={styles.nota}>
        ¿Olvidaste tu contraseña? Pide a tu administrador que la restablezca.
      </p>
    </AuthLayout>
  );
}
