import { ChartNoAxesColumn, ShieldAlert } from 'lucide-react';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import { useAuthStore } from '../../auth/stores/auth.store';
import styles from './InicioAdminPage.module.css';

// Inicio del administrador; el dashboard de sus sucursales llega en I7
export function InicioAdminPage() {
  const usuario = useAuthStore((s) => s.usuario);
  if (!usuario) return null;

  const { sucursales, permisos } = usuario;
  const sinAcceso = permisos.length === 0 || sucursales.length === 0;

  return (
    <>
      <header className={styles.encabezado}>
        <h1 className="titulo-pagina">Hola, {usuario.nombres}</h1>
        {sucursales.length > 0 && (
          <p className={styles.alcance}>
            {sucursales.length === 1
              ? `${sucursales[0].nombre} · ${sucursales[0].empresa.nombre}`
              : `${sucursales.length} sucursales a tu cargo`}
          </p>
        )}
      </header>

      {sinAcceso ? (
        <EstadoVacio icono={ShieldAlert} titulo="Todavía no tienes permisos o sucursales asignados">
          <p>
            El superusuario decide qué puedes hacer y en qué sucursales. Cuando te los asigne, las opciones aparecerán en el
            menú sin que tengas que volver a iniciar sesión.
          </p>
        </EstadoVacio>
      ) : (
        <EstadoVacio icono={ChartNoAxesColumn} titulo="Aquí verás cómo va la capacitación de tus sucursales">
          <p>
            Cuando tus sucursales tengan cursos asignados, este inicio mostrará el cumplimiento de los obligatorios, los
            cursos por vencer y quién necesita apoyo.
          </p>
          <p>Las opciones de tus permisos aparecerán en el menú en cuanto estén disponibles.</p>
        </EstadoVacio>
      )}
    </>
  );
}
