import { BookOpen } from 'lucide-react';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import { useAuthStore } from '../../auth/stores/auth.store';
import styles from './InicioAdminPage.module.css';

// Inicio del empleado (HU-13). Sus cursos, avance y certificados llegan en I4 a I6.
export function InicioEmpleadoPage() {
  const usuario = useAuthStore((s) => s.usuario);
  if (!usuario) return null;

  const { sucursal, empleado } = usuario;

  return (
    <>
      <header className={styles.encabezado}>
        <h1 className="titulo-pagina">Hola, {usuario.nombres}</h1>
        {sucursal && (
          <p className={styles.alcance}>
            {empleado ? `${empleado.puesto.nombre} · ` : ''}
            {sucursal.nombre} · {sucursal.empresa.nombre}
          </p>
        )}
      </header>

      <EstadoVacio icono={BookOpen} titulo="Aún no tienes cursos asignados">
        <p>Cuando tu empresa te asigne un curso, aparecerá aquí con tu avance y la fecha límite para terminarlo.</p>
      </EstadoVacio>
    </>
  );
}
