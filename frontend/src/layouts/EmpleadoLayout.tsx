import { NavLink, Outlet } from 'react-router';
import { LogoPlataforma } from '../components/ui/LogoPlataforma';
import { Toaster } from '../components/ui/Toaster';
import styles from './EmpleadoLayout.module.css';
import { MenuUsuario } from './MenuUsuario';

// Navegacion del empleado (design-reference 9.2): horizontal arriba, sin barra lateral.
// "Mis cursos" y "Mis certificados" se agregan cuando existan (I4 e I6).
const OPCIONES = [
  { etiqueta: 'Inicio', ruta: '/' },
  { etiqueta: 'Mi perfil', ruta: '/perfil' },
];

export function EmpleadoLayout() {
  return (
    <div className={styles.pagina}>
      <a href="#contenido" className={styles.saltar}>
        Saltar al contenido
      </a>
      <header className={styles.superior}>
        <div className={styles.barra}>
          <NavLink to="/" className={styles.logo} aria-label="Cursos, ir al inicio">
            <LogoPlataforma />
          </NavLink>
          <nav aria-label="Principal">
            <ul className={styles.menu}>
              {OPCIONES.map((opcion) => (
                <li key={opcion.ruta}>
                  <NavLink to={opcion.ruta} end className={({ isActive }) => (isActive ? `${styles.opcion} ${styles.activa}` : styles.opcion)}>
                    {opcion.etiqueta}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <MenuUsuario />
        </div>
      </header>
      <main id="contenido" className={styles.contenido} tabIndex={-1}>
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
