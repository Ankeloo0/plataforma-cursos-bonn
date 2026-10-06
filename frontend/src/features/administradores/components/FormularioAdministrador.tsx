import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { CampoFoto } from '../../../components/ui/CampoFoto';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import type { ApiError } from '../../../services/api/client';
import { ListaPolitica } from '../../auth/components/ListaPolitica';
import { cumplePolitica } from '../../auth/utils/politica-password';
import type { Administrador, DatosAdministrador } from '../types/administradores.types';
import styles from '../../../components/ui/Formulario.module.css';

const datosPersona = {
  nombres: z.string().trim().min(1, 'Escribe los nombres.').max(80, 'Máximo 80 caracteres.'),
  apellidoPaterno: z.string().trim().min(1, 'Escribe el apellido paterno.').max(60, 'Máximo 60 caracteres.'),
  apellidoMaterno: z.string().trim().max(60, 'Máximo 60 caracteres.'),
  username: z
    .string()
    .trim()
    .min(3, 'El usuario debe tener al menos 3 caracteres.')
    .max(50, 'Máximo 50 caracteres.')
    .regex(/^[A-Za-z0-9._-]+$/, 'Usa solo letras sin acentos, números, punto, guion y guion bajo.'),
};

// La contrasena temporal solo se pide en el alta
const crearEsquema = (esAlta: boolean) =>
  z.object({ ...datosPersona, passwordTemporal: z.string() }).superRefine((datos, ctx) => {
    if (esAlta && !cumplePolitica(datos.passwordTemporal)) {
      ctx.addIssue({ code: 'custom', path: ['passwordTemporal'], message: 'La contraseña no cumple con las reglas de abajo.' });
    }
  });

type Datos = z.infer<ReturnType<typeof crearEsquema>>;

export interface CambiosAdministrador {
  datos: DatosAdministrador;
  passwordTemporal?: string;
  // undefined = sin cambios; File = foto nueva; null = quitar
  foto: File | null | undefined;
}

// Alta y edicion de un administrador (RF-00.2, RF-00.3)
export function FormularioAdministrador({
  administrador,
  alGuardar,
  alCancelar,
}: {
  administrador?: Administrador;
  alGuardar: (cambios: CambiosAdministrador) => Promise<void>;
  alCancelar: () => void;
}) {
  const esAlta = !administrador;
  const [foto, setFoto] = useState<File | null | undefined>(undefined);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(crearEsquema(esAlta)),
    mode: 'onBlur',
    defaultValues: {
      nombres: administrador?.nombres ?? '',
      apellidoPaterno: administrador?.apellidoPaterno ?? '',
      apellidoMaterno: administrador?.apellidoMaterno ?? '',
      username: administrador?.username ?? '',
      passwordTemporal: '',
    },
  });
  const [nombres, apellidoPaterno, password] = useWatch({ control, name: ['nombres', 'apellidoPaterno', 'passwordTemporal'] });

  async function enviar(valores: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar({
        datos: {
          nombres: valores.nombres,
          apellidoPaterno: valores.apellidoPaterno,
          apellidoMaterno: valores.apellidoMaterno || null,
          username: valores.username,
        },
        passwordTemporal: esAlta ? valores.passwordTemporal : undefined,
        foto,
      });
    } catch (error) {
      const { code, message } = error as ApiError;
      if (code === 'USUARIO_USERNAME_DUPLICADO') setError('username', { message }, { shouldFocus: true });
      else setErrorServidor(message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <p className={styles.nota}>Los campos con * son obligatorios.</p>
      <CampoFoto
        idPersona={administrador?.id ?? 'nuevo'}
        nombres={nombres}
        apellidoPaterno={apellidoPaterno}
        fotoActual={administrador?.fotoUrl ?? null}
        valor={foto}
        alCambiar={setFoto}
      />
      <Input etiqueta="Nombres" required autoComplete="off" error={errors.nombres?.message} {...register('nombres')} />
      <Input etiqueta="Apellido paterno" required autoComplete="off" error={errors.apellidoPaterno?.message} {...register('apellidoPaterno')} />
      <Input etiqueta="Apellido materno" autoComplete="off" error={errors.apellidoMaterno?.message} {...register('apellidoMaterno')} />
      <Input
        etiqueta="Usuario"
        required
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="p. ej. jperez"
        ayuda="Con él inicia sesión. Único en toda la plataforma, sin acentos ni espacios."
        error={errors.username?.message}
        {...register('username')}
      />
      {esAlta && (
        <div className={styles.grupo}>
          <PasswordInput
            etiqueta="Contraseña temporal"
            required
            autoComplete="new-password"
            error={errors.passwordTemporal?.message}
            aria-describedby="politica-admin"
            {...register('passwordTemporal')}
          />
          <ListaPolitica id="politica-admin" password={password} />
          <p className={styles.aviso}>Entrégasela al administrador. Al entrar por primera vez deberá crear la suya.</p>
        </div>
      )}
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={styles.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {esAlta ? 'Crear administrador' : 'Guardar cambios'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
