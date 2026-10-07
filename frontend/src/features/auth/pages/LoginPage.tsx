import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Pestanas } from '../../../components/ui/Pestanas';
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

      <Pestanas
        etiqueta="Tipo de acceso"
        opciones={PESTANAS.map((p) => ({ valor: p.acceso, etiqueta: p.texto }))}
        valor={acceso}
        alCambiar={setAcceso}
        idPanel="panel-acceso"
        className={styles.pestanasAcceso}
      />

      <div role="tabpanel" id="panel-acceso" aria-labelledby={`panel-acceso-${acceso}`}>
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
