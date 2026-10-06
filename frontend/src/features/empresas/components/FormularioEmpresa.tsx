import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import styles from '../../../components/ui/Formulario.module.css';
import { Input } from '../../../components/ui/Input';
import type { ApiError } from '../../../services/api/client';
import type { DatosEmpresa, Empresa } from '../types/empresas.types';

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la empresa.').max(120, 'Máximo 120 caracteres.'),
  razonSocial: z.string().trim().max(200, 'Máximo 200 caracteres.'),
  prefijoFolio: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, 'De 2 a 6 letras sin acentos o números, por ejemplo GB.'),
});

type Datos = z.infer<typeof esquema>;

export function FormularioEmpresa({
  empresa,
  alGuardar,
  alCancelar,
}: {
  empresa?: Empresa;
  alGuardar: (datos: DatosEmpresa) => Promise<void>;
  alCancelar: () => void;
}) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: {
      nombre: empresa?.nombre ?? '',
      razonSocial: empresa?.razonSocial ?? '',
      prefijoFolio: empresa?.prefijoFolio ?? '',
    },
  });

  async function enviar(datos: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar({ nombre: datos.nombre, razonSocial: datos.razonSocial || null, prefijoFolio: datos.prefijoFolio });
    } catch (error) {
      const { code, message } = error as ApiError;
      if (code === 'EMPRESA_NOMBRE_DUPLICADO') setError('nombre', { message }, { shouldFocus: true });
      else if (code === 'EMPRESA_PREFIJO_DUPLICADO') setError('prefijoFolio', { message }, { shouldFocus: true });
      else setErrorServidor(message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <p className={styles.nota}>Los campos con * son obligatorios.</p>
      <Input etiqueta="Nombre" required placeholder="p. ej. Grupo Bonn" ayuda="Único en la plataforma." error={errors.nombre?.message} {...register('nombre')} />
      <Input etiqueta="Razón social" placeholder="p. ej. Automotriz Bonn S.A. de C.V." error={errors.razonSocial?.message} {...register('razonSocial')} />
      <Input
        etiqueta="Prefijo del folio"
        required
        placeholder="p. ej. GB"
        maxLength={6}
        autoCapitalize="characters"
        spellCheck={false}
        ayuda={
          empresa
            ? 'Los certificados nuevos usarán el prefijo nuevo; los ya emitidos conservan su folio.'
            : 'Con él empiezan los folios de sus certificados: GB-2026-000123.'
        }
        error={errors.prefijoFolio?.message}
        {...register('prefijoFolio')}
      />
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={styles.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {empresa ? 'Guardar cambios' : 'Crear empresa'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
