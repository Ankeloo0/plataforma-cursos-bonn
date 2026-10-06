import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import type { ApiError } from '../../../services/api/client';
import styles from '../pages/AuthPages.module.css';
import { useAuthStore } from '../stores/auth.store';
import type { Perfil } from '../types/auth.types';

const esquema = z.object({
  username: z.string().trim().min(1, 'Escribe tu usuario.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

type Datos = z.infer<typeof esquema>;

// Administradores y superusuario
export function FormularioLoginAdministrador({ alEntrar }: { alEntrar: (usuario: Perfil) => void }) {
  const iniciarSesion = useAuthStore((s) => s.iniciarSesion);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema), mode: 'onBlur' });

  async function enviar({ username, password }: Datos) {
    setErrorServidor(null);
    try {
      alEntrar(await iniciarSesion(username, password));
    } catch (error) {
      setErrorServidor((error as ApiError).message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <Input
        etiqueta="Usuario"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="p. ej. jperez"
        error={errors.username?.message}
        {...register('username')}
      />
      <PasswordInput
        etiqueta="Contraseña"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      {errorServidor && <Alerta>{errorServidor}</Alerta>}

      <Button type="submit" tamano="grande" icono={LogIn} cargando={isSubmitting} textoCargando="Ingresando…" className={styles.enviar}>
        Ingresar
      </Button>
    </form>
  );
}
