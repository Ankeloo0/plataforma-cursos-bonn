import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { CampoFoto } from '../../../components/ui/CampoFoto';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import { ListaPolitica } from '../../auth/components/ListaPolitica';
import { authService } from '../../auth/services/auth.service';
import type { EmpresaLogin } from '../../auth/types/auth.types';
import { cumplePolitica } from '../../auth/utils/politica-password';
import type { Administrador, DatosAdministrador } from '../types/administradores.types';
import styles from '../../../components/ui/Formulario.module.css';

const datosPersona = {
  nombres: z.string().trim().min(1, 'Escribe los nombres.').max(80, 'Máximo 80 caracteres.'),
  apellidoPaterno: z.string().trim().min(1, 'Escribe el apellido paterno.').max(60, 'Máximo 60 caracteres.'),
  apellidoMaterno: z.string().trim().max(60, 'Máximo 60 caracteres.'),
  empresaId: z.string().min(1, 'Elige la empresa.'),
  numeroEmpleado: z
    .string()
    .trim()
    .min(1, 'Escribe el número de empleado.')
    .max(20, 'Máximo 20 caracteres.')
    .regex(/^[A-Za-z0-9-]+$/, 'Usa solo letras sin acentos, números y guion.'),
};

//que error de la API va junto a que campo
const CAMPO_DEL_ERROR: Record<string, 'empresaId' | 'numeroEmpleado'> = {
  EMPLEADO_NUMERO_DUPLICADO: 'numeroEmpleado',
  EMPRESA_INACTIVA: 'empresaId',
  EMPRESA_NO_ENCONTRADA: 'empresaId',
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

interface Props {
  administrador?: Administrador;
  alGuardar: (cambios: CambiosAdministrador) => Promise<void>;
  alCancelar: () => void;
}

// Alta y edicion de un administrador (RF-00.2, RF-00.3). Entra con la empresa y el numero que se eligen aqui.
export function FormularioAdministrador(props: Props) {
  const empresas = useConsulta(authService.listarEmpresas);

  if (empresas.estado === 'cargando') {
    return (
      <div className={styles.formulario} aria-busy="true">
        <Skeleton alto={68} />
        <Skeleton alto={68} />
        <Skeleton alto={68} />
      </div>
    );
  }
  if (empresas.estado === 'error') {
    return (
      <div className={styles.formulario}>
        <Alerta>No se pudo cargar la lista de empresas. Revisa tu conexión e intenta de nuevo.</Alerta>
        <Button variante="secundario" onClick={empresas.recargar}>
          Reintentar
        </Button>
      </div>
    );
  }
  return <Campos {...props} empresas={empresas.datos} />;
}

// Se monta con la lista ya cargada para que la empresa actual quede elegida desde el inicio
function Campos({ administrador, alGuardar, alCancelar, empresas }: Props & { empresas: EmpresaLogin[] }) {
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
      empresaId: administrador?.empresaId ?? (empresas.length === 1 ? empresas[0].id : ''),
      numeroEmpleado: administrador?.numeroEmpleado ?? '',
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
          empresaId: valores.empresaId,
          numeroEmpleado: valores.numeroEmpleado,
        },
        passwordTemporal: esAlta ? valores.passwordTemporal : undefined,
        foto,
      });
    } catch (error) {
      const { code, message } = error as ApiError;
      const campo = code ? CAMPO_DEL_ERROR[code] : undefined;
      if (campo) setError(campo, { message }, { shouldFocus: true });
      else setErrorServidor(message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <p className={styles.nota}>Los campos con * son obligatorios.</p>
      {administrador && !administrador.numeroEmpleado && (
        <Alerta tono="info">Todavía no tiene número de empleado. Elige su empresa y su número para que pueda iniciar sesión.</Alerta>
      )}
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
      <Select
        etiqueta="Empresa"
        required
        textoVacio="Elige la empresa"
        opciones={empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }))}
        ayuda="La empresa en la que trabaja. No limita las sucursales que administra."
        error={errors.empresaId?.message}
        {...register('empresaId')}
      />
      <Input
        etiqueta="Número de empleado"
        required
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="p. ej. 1024"
        ayuda="Con él y su empresa inicia sesión. No se repite dentro de la empresa."
        error={errors.numeroEmpleado?.message}
        {...register('numeroEmpleado')}
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
