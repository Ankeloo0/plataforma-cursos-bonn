import type { ReactNode } from 'react';
import { LogoPlataforma } from '../components/ui/LogoPlataforma';
import styles from './AuthLayout.module.css';

// Inicio de sesion y "Crea tu contrasena" (brief en .impeccable/surfaces)
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.pantalla}>
      <aside className={styles.marca} aria-hidden="true">
        <div className={styles.marcaTexto}>
          <p className={styles.marcaNombre}>Capacitación</p>
          <p className={styles.marcaLinea}>
            Cursos, evaluaciones y certificados de todas las sucursales, en un solo lugar.
          </p>
        </div>
      </aside>

      <main className={styles.acceso}>
        <div className={styles.contenido}>
          <LogoPlataforma alto={64} className={styles.logo} />
          {children}
        </div>
      </main>
    </div>
  );
}
