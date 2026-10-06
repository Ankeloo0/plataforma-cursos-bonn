import { NavLink } from 'react-router';
import { opcionesDeMenu } from '../config/menu.config';
import type { Perfil } from '../features/auth/types/auth.types';
import styles from './PanelLayout.module.css';

export function NavegacionPanel({ usuario, alNavegar }: { usuario: Perfil; alNavegar?: () => void }) {
  return (
    <nav aria-label="Menú principal">
      <ul className={styles.menu}>
        {opcionesDeMenu(usuario).map(({ etiqueta, ruta, icono: Icono }) => (
          <li key={ruta}>
            <NavLink
              to={ruta}
              end={ruta === '/panel'}
              className={({ isActive }) => [styles.opcion, isActive && styles.activa].filter(Boolean).join(' ')}
              onClick={alNavegar}
            >
              <Icono size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>{etiqueta}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
