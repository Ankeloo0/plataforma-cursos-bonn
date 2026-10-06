import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { useAuthStore } from '../../auth/stores/auth.store';
import styles from './InicioProvisionalPage.module.css';

// Inicio temporal del empleado; se reemplaza por EmpleadoLayout en I2 (HU-13)
export function InicioProvisionalPage() {
  const { usuario, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  if (!usuario) return null;

  async function salir() {
    await cerrarSesion();
    navigate('/login', { replace: true });
  }

  return (
    <main className={styles.pagina}>
      <h1 className="titulo-pagina">Hola, {usuario.nombres}</h1>
      <p className={styles.texto}>
        Entraste como {usuario.rol.toLowerCase()}
        {usuario.sucursal ? ` de ${usuario.sucursal.nombre}` : ''}. Tus cursos aparecerán aquí muy pronto.
      </p>
      <Button variante="secundario" icono={LogOut} onClick={salir}>
        Cerrar sesión
      </Button>
    </main>
  );
}
