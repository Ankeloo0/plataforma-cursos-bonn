import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { rutaInicio } from '../../../utils/rutas';
import { FormularioLoginAdministrador } from '../components/FormularioLoginAdministrador';
import { FormularioLoginEmpleado } from '../components/FormularioLoginEmpleado';
import type { Perfil } from '../types/auth.types';
import styles from './AuthPages.module.css';

type Acceso = 'empleado' | 'administrador';

const PESTANAS: { acceso: Acceso; texto: string; bajada: string }[] = [
  { acceso: 'empleado', texto: 'Empleado', bajada: 'Ingresa con tu número de empleado y la contraseña que te dio tu administrador.' },
  { acceso: 'administrador', texto: 'Administrador', bajada: 'Ingresa con tu usuario y tu contraseña.' },
];

// El empleado entra con empresa y numero de empleado; administradores y superusuario, con usuario (D-34)
export function LoginPage() {
  const navigate = useNavigate();
  const ubicacion = useLocation();
  const [acceso, setAcceso] = useState<Acceso>('empleado');
  const actual = PESTANAS.find((p) => p.acceso === acceso)!;

  function alEntrar(usuario: Perfil) {
    const desde = (ubicacion.state as { desde?: string } | null)?.desde;
    if (usuario.debeCambiarPassword) navigate('/cambiar-password', { replace: true });
    else navigate(desde ?? rutaInicio(usuario.rol), { replace: true });
  }

  return (
    <AuthLayout>
      <h1 className={styles.titulo}>Te damos la bienvenida</h1>
      <p className={styles.bajada}>{actual.bajada}</p>

      <div role="tablist" aria-label="Tipo de acceso" className={styles.pestanas}>
        {PESTANAS.map((p) => (
          <button
            key={p.acceso}
            type="button"
            role="tab"
            id={`pestana-${p.acceso}`}
            aria-selected={p.acceso === acceso}
            aria-controls="panel-acceso"
            className={styles.pestana}
            onClick={() => setAcceso(p.acceso)}
          >
            {p.texto}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panel-acceso" aria-labelledby={`pestana-${acceso}`}>
        {acceso === 'empleado' ? (
          <FormularioLoginEmpleado alEntrar={alEntrar} />
        ) : (
          <FormularioLoginAdministrador alEntrar={alEntrar} />
        )}
      </div>

      <p className={styles.nota}>
        ¿Olvidaste tu contraseña? Pide a tu administrador que la restablezca.
      </p>
    </AuthLayout>
  );
}
