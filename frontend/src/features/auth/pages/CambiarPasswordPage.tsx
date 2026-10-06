import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { AuthLayout } from '../../../layouts/AuthLayout';
import type { ApiError } from '../../../services/api/client';
import { rutaInicio } from '../../../utils/rutas';
import { ListaPolitica } from '../components/ListaPolitica';
import { useAuthStore } from '../stores/auth.store';
import { cumplePolitica } from '../utils/politica-password';
import styles from './AuthPages.module.css';

const esquema = z
  .object({
    actual: z.string().min(1, 'Escribe la contraseña con la que entraste.'),
    nueva: z.string().refine(cumplePolitica, 'La contraseña no cumple con las reglas de abajo.'),
    confirmacion: z.string().min(1, 'Vuelve a escribir la nueva contraseña.'),
  })
  .refine((d) => d.nueva === d.confirmacion, {
    path: ['confirmacion'],
    message: 'Las contraseñas no coinciden. Escríbela igual en los dos campos.',
  })
  .refine((d) => d.nueva !== d.actual, {
    path: ['nueva'],
    message: 'La nueva contraseña debe ser distinta de la actual.',
  });

type Datos = z.infer<typeof esquema>;

// Cambio obligatorio en el primer acceso (RF-01.2) o voluntario desde Mi perfil (RF-01.3)
export function CambiarPasswordPage() {
  const { usuario, cambiarPassword, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const esTemporal = usuario?.debeCambiarPassword ?? false;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema), mode: 'onBlur', defaultValues: { nueva: '' } });
  const nueva = useWatch({ control, name: 'nueva' });

  async function enviar({ actual, nueva }: Datos) {
    setErrorServidor(null);
    try {
      const actualizado = await cambiarPassword(actual, nueva);
      navigate(rutaInicio(actualizado.rol), { replace: true });
    } catch (error) {
      const { code, message } = error as ApiError;
      if (code === 'PASSWORD_ACTUAL_INCORRECTA') setError('actual', { message }, { shouldFocus: true });
      else if (code === 'PASSWORD_REPETIDA') setError('nueva', { message }, { shouldFocus: true });
      else setErrorServidor(message);
    }
  }

  async function salir() {
    await cerrarSesion();
    navigate('/login', { replace: true });
  }

  return (
    <AuthLayout>
      <h1 className={styles.titulo}>{esTemporal ? 'Crea tu contraseña' : 'Cambia tu contraseña'}</h1>
      <p className={styles.bajada}>
        {esTemporal
          ? 'La contraseña con la que entraste es temporal. Crea una que solo tú conozcas para continuar.'
          : 'Escribe tu contraseña actual y la nueva. Se cerrará tu sesión en los demás dispositivos.'}
      </p>

      <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
        <PasswordInput
          etiqueta={esTemporal ? 'Contraseña temporal' : 'Contraseña actual'}
          autoComplete="current-password"
          error={errors.actual?.message}
          {...register('actual')}
        />
        <div className={styles.grupo}>
          <PasswordInput
            etiqueta="Nueva contraseña"
            autoComplete="new-password"
            error={errors.nueva?.message}
            aria-describedby="politica-password"
            {...register('nueva')}
          />
          <ListaPolitica id="politica-password" password={nueva} />
        </div>
        <PasswordInput
          etiqueta="Confirma la nueva contraseña"
          autoComplete="new-password"
          error={errors.confirmacion?.message}
          {...register('confirmacion')}
        />

        {errorServidor && <Alerta>{errorServidor}</Alerta>}

        <div className={styles.acciones}>
          <Button type="submit" tamano="grande" cargando={isSubmitting} textoCargando="Guardando…" className={styles.enviar}>
            Guardar contraseña
          </Button>
          {esTemporal ? (
            <Button variante="texto" onClick={salir}>
              Salir
            </Button>
          ) : (
            <Button variante="texto" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
