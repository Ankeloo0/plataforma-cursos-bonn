import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { CampoFoto } from '../../../components/ui/CampoFoto';
import styles from '../../../components/ui/Formulario.module.css';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Select } from '../../../components/ui/Select';
import type { ApiError } from '../../../services/api/client';
import { ListaPolitica } from '../../auth/components/ListaPolitica';
import { cumplePolitica } from '../../auth/utils/politica-password';
import type { Puesto } from '../../catalogo/types/catalogo.types';
import type { Sucursal } from '../../empresas/types/empresas.types';
import type { DatosEmpleado, Empleado } from '../types/empleados.types';

const crearEsquema = (esAlta: boolean) =>
  z
    .object({
      sucursalId: z.string().min(1, 'Elige la sucursal.'),
      numeroEmpleado: z
        .string()
        .trim()
        .min(1, 'Escribe el número de empleado.')
        .max(20, 'Máximo 20 caracteres.')
        .regex(/^[A-Za-z0-9-]+$/, 'Usa solo letras sin acentos, números y guion.'),
      nombres: z.string().trim().min(1, 'Escribe los nombres.').max(80, 'Máximo 80 caracteres.'),
      apellidoPaterno: z.string().trim().min(1, 'Escribe el apellido paterno.').max(60, 'Máximo 60 caracteres.'),
      apellidoMaterno: z.string().trim().max(60, 'Máximo 60 caracteres.'),
      puestoId: z.string().min(1, 'Elige el puesto.'),
      fechaIngreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escribe la fecha de ingreso.'),
      passwordTemporal: z.string(),
    })
    .superRefine((datos, ctx) => {
      if (esAlta && !cumplePolitica(datos.passwordTemporal)) {
        ctx.addIssue({ code: 'custom', path: ['passwordTemporal'], message: 'La contraseña no cumple con las reglas de abajo.' });
      }
    });

type Datos = z.infer<ReturnType<typeof crearEsquema>>;

export interface CambiosEmpleado {
  datos: DatosEmpleado;
  passwordTemporal?: string;
  // undefined = sin cambios; File = foto nueva; null = quitar
  foto: File | null | undefined;
}

// Que error de la API va junto a que campo
const CAMPO_DEL_ERROR: Record<string, keyof Datos> = {
  EMPLEADO_NUMERO_DUPLICADO: 'numeroEmpleado',
  PUESTO_INACTIVO: 'puestoId',
  PUESTO_NO_ENCONTRADO: 'puestoId',
  SUCURSAL_INACTIVA: 'sucursalId',
  SUCURSAL_NO_ENCONTRADA: 'sucursalId',
  TRASLADO_OTRA_EMPRESA: 'sucursalId',
};

// Alta y edicion de un empleado (RF-03.1, RF-03.3). El empleado no tiene usuario: entra con su
// empresa y su numero (D-34). Al editar, solo se ofrecen sucursales de su misma empresa.
export function FormularioEmpleado({
  empleado,
  sucursales,
  puestos,
  alGuardar,
  alCancelar,
}: {
  empleado?: Empleado;
  sucursales: Sucursal[];
  puestos: Puesto[];
  alGuardar: (cambios: CambiosEmpleado) => Promise<void>;
  alCancelar: () => void;
}) {
  const esAlta = !empleado;
  const [foto, setFoto] = useState<File | null | undefined>(undefined);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const opcionesSucursal = sucursales
    .filter((s) => (s.activo && s.empresa.activo) || s.id === empleado?.sucursal.id)
    .filter((s) => !empleado || s.empresa.id === empleado.empresa.id)
    .map((s) => ({ valor: s.id, etiqueta: `${s.nombre} · ${s.empresa.nombre}` }));
  const opcionesPuesto = puestos
    .filter((p) => p.activo || p.id === empleado?.puesto.id)
    .map((p) => ({ valor: p.id, etiqueta: `${p.nombre} · ${p.area.nombre}` }));

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
      sucursalId: empleado?.sucursal.id ?? (opcionesSucursal.length === 1 ? opcionesSucursal[0].valor : ''),
      numeroEmpleado: empleado?.numeroEmpleado ?? '',
      nombres: empleado?.nombres ?? '',
      apellidoPaterno: empleado?.apellidoPaterno ?? '',
      apellidoMaterno: empleado?.apellidoMaterno ?? '',
      puestoId: empleado?.puesto.id ?? '',
      fechaIngreso: empleado?.fechaIngreso ?? '',
      passwordTemporal: '',
    },
  });
  const [nombres, apellidoPaterno, password] = useWatch({ control, name: ['nombres', 'apellidoPaterno', 'passwordTemporal'] });

  async function enviar(valores: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar({
        datos: {
          sucursalId: valores.sucursalId,
          numeroEmpleado: valores.numeroEmpleado,
          nombres: valores.nombres,
          apellidoPaterno: valores.apellidoPaterno,
          apellidoMaterno: valores.apellidoMaterno || null,
          puestoId: valores.puestoId,
          fechaIngreso: valores.fechaIngreso,
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
      <CampoFoto
        idPersona={empleado?.usuarioId ?? 'nuevo'}
        nombres={nombres}
        apellidoPaterno={apellidoPaterno}
        fotoActual={empleado?.fotoUrl ?? null}
        valor={foto}
        alCambiar={setFoto}
      />
      <Select
        etiqueta="Sucursal"
        required
        textoVacio="Elige la sucursal"
        opciones={opcionesSucursal}
        ayuda={empleado ? 'Solo sucursales de la misma empresa. Entre empresas se da de baja y de alta.' : undefined}
        error={errors.sucursalId?.message}
        {...register('sucursalId')}
      />
      <Input
        etiqueta="Número de empleado"
        required
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="p. ej. 1024"
        ayuda="Con él inicia sesión, junto con su empresa. No se repite dentro de la empresa."
        error={errors.numeroEmpleado?.message}
        {...register('numeroEmpleado')}
      />
      <Input etiqueta="Nombres" required autoComplete="off" error={errors.nombres?.message} {...register('nombres')} />
      <Input etiqueta="Apellido paterno" required autoComplete="off" error={errors.apellidoPaterno?.message} {...register('apellidoPaterno')} />
      <Input etiqueta="Apellido materno" autoComplete="off" error={errors.apellidoMaterno?.message} {...register('apellidoMaterno')} />
      <Select
        etiqueta="Puesto"
        required
        textoVacio="Elige el puesto"
        opciones={opcionesPuesto}
        ayuda="El área se toma del puesto."
        error={errors.puestoId?.message}
        {...register('puestoId')}
      />
      <Input etiqueta="Fecha de ingreso" type="date" required error={errors.fechaIngreso?.message} {...register('fechaIngreso')} />
      {esAlta && (
        <div className={styles.grupo}>
          <PasswordInput
            etiqueta="Contraseña temporal"
            required
            autoComplete="new-password"
            error={errors.passwordTemporal?.message}
            aria-describedby="politica-empleado"
            {...register('passwordTemporal')}
          />
          <ListaPolitica id="politica-empleado" password={password} />
          <p className={styles.aviso}>Entrégasela al empleado con su número. Al entrar por primera vez deberá crear la suya.</p>
        </div>
      )}
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={styles.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {esAlta ? 'Dar de alta' : 'Guardar cambios'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
