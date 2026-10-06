import { ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar } from '../components/ui/Avatar';
import { useAuthStore } from '../features/auth/stores/auth.store';
import styles from './PanelLayout.module.css';

// Boton que muestra y oculta una lista de enlaces (patron disclosure, no role="menu")
export function MenuUsuario() {
  const { usuario, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idLista = useId();

  useEffect(() => {
    if (!abierto) return;
    function alPresionar(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    }
    document.addEventListener('mousedown', alPresionar);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alPresionar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  if (!usuario) return null;

  async function salir() {
    await cerrarSesion();
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.usuario} ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className={styles.usuarioBoton}
        aria-expanded={abierto}
        aria-controls={idLista}
        onClick={() => setAbierto((a) => !a)}
      >
        <Avatar id={usuario.id} nombres={usuario.nombres} apellidoPaterno={usuario.apellidoPaterno} src={usuario.fotoUrl} tamano={32} decorativo />
        <span className={styles.usuarioNombre}>
          {usuario.nombres} {usuario.apellidoPaterno}
        </span>
        <span className="solo-lector">Opciones de tu cuenta</span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className={styles.chevron} />
      </button>

      {abierto && (
        <ul id={idLista} className={styles.usuarioLista}>
          <li>
            <Link to="/perfil" className={styles.usuarioOpcion} onClick={() => setAbierto(false)}>
              <UserRound size={20} strokeWidth={1.75} aria-hidden="true" />
              Mi perfil
            </Link>
          </li>
          <li>
            <Link to="/cambiar-password" className={styles.usuarioOpcion} onClick={() => setAbierto(false)}>
              <KeyRound size={20} strokeWidth={1.75} aria-hidden="true" />
              Cambiar contraseña
            </Link>
          </li>
          <li className={styles.separado}>
            <button type="button" className={styles.usuarioOpcion} onClick={salir}>
              <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
              Cerrar sesión
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
