import { Menu, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Avatar } from '../components/ui/Avatar';
import { LogoPlataforma } from '../components/ui/LogoPlataforma';
import { Toaster } from '../components/ui/Toaster';
import { NOMBRE_ROL } from '../config/menu.config';
import { rutaInicio } from '../utils/rutas';
import { useAuthStore } from '../features/auth/stores/auth.store';
import { MenuUsuario } from './MenuUsuario';
import { NavegacionPanel } from './NavegacionPanel';
import styles from './PanelLayout.module.css';

// Superusuario y administrador (design-reference 9.1, brief en .impeccable/surfaces)
export function PanelLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const cajon = useRef<HTMLDialogElement>(null);
  const ubicacion = useLocation();

  // Al navegar desde el cajon, se cierra
  useEffect(() => {
    cajon.current?.close();
  }, [ubicacion.pathname]);

  if (!usuario) return null;

  const pie = (
    <div className={styles.pie}>
      <Avatar id={usuario.id} nombres={usuario.nombres} apellidoPaterno={usuario.apellidoPaterno} src={usuario.fotoUrl} tamano={32} decorativo />
      <div className={styles.pieTexto}>
        <span className={styles.pieNombre}>
          {usuario.nombres} {usuario.apellidoPaterno}
        </span>
        <span className={styles.pieRol}>{NOMBRE_ROL[usuario.rol]}</span>
        {usuario.rol === 'ADMIN' && <span className={styles.pieAlcance}>{resumenSucursales(usuario.sucursales.length, usuario.sucursales[0]?.nombre)}</span>}
      </div>
    </div>
  );

  return (
    <div className={styles.panel}>
      <a href="#contenido" className={styles.saltar}>
        Saltar al contenido
      </a>

      <aside className={styles.lateral}>
        <LogoPlataforma className={styles.logo} />
        <NavegacionPanel usuario={usuario} />
        {pie}
      </aside>

      {/* dialog con showModal: atrapa el foco, cierra con Escape y devuelve el foco al boton */}
      <dialog
        ref={cajon}
        className={styles.cajon}
        aria-label="Menú"
        onClick={(evento) => {
          if (evento.target === cajon.current) cajon.current.close();
        }}
      >
        <div className={styles.cajonContenido}>
          <div className={styles.cajonEncabezado}>
            <LogoPlataforma className={styles.logo} />
            <button type="button" className={styles.iconoBoton} aria-label="Cerrar menú" onClick={() => cajon.current?.close()}>
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <NavegacionPanel usuario={usuario} alNavegar={() => cajon.current?.close()} />
          {pie}
        </div>
      </dialog>

      <header className={styles.superior}>
        <button
          type="button"
          className={`${styles.iconoBoton} ${styles.abrirMenu}`}
          aria-label="Abrir menú"
          onClick={() => cajon.current?.showModal()}
        >
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <Link to={rutaInicio(usuario.rol)} className={styles.logoSuperior} aria-label="Cursos, ir al inicio">
          <LogoPlataforma className={styles.logo} />
        </Link>
        <MenuUsuario />
      </header>

      <main id="contenido" className={styles.contenido} tabIndex={-1}>
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}

function resumenSucursales(total: number, primera: string | undefined): string {
  if (total === 0) return 'Sin sucursales asignadas';
  if (total === 1) return primera ?? '';
  return `${total} sucursales`;
}
