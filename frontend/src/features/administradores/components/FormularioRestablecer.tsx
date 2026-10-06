import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import type { ApiError } from '../../../services/api/client';
import { ListaPolitica } from '../../auth/components/ListaPolitica';
import { cumplePolitica } from '../../auth/utils/politica-password';
import styles from '../../../components/ui/Formulario.module.css';

const esquema = z.object({
  passwordTemporal: z.string().refine(cumplePolitica, 'La contraseña no cumple con las reglas de abajo.'),
});

type Datos = z.infer<typeof esquema>;

// RF-01.4 y RF-01.5
export function FormularioRestablecer({
  alGuardar,
  alCancelar,
}: {
  alGuardar: (passwordTemporal: string) => Promise<void>;
  alCancelar: () => void;
}) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema), mode: 'onBlur', defaultValues: { passwordTemporal: '' } });
  const password = useWatch({ control, name: 'passwordTemporal' });

  async function enviar({ passwordTemporal }: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar(passwordTemporal);
    } catch (error) {
      setErrorServidor((error as ApiError).message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <div className={styles.grupo}>
        <PasswordInput
          etiqueta="Nueva contraseña temporal"
          required
          autoComplete="new-password"
          error={errors.passwordTemporal?.message}
          aria-describedby="politica-restablecer"
          {...register('passwordTemporal')}
        />
        <ListaPolitica id="politica-restablecer" password={password} />
      </div>
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={styles.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Restableciendo…">
          Restablecer contraseña
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
