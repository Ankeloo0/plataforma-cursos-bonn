import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import styles from '../pages/AuthPages.module.css';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../stores/auth.store';
import type { EmpresaLogin, Perfil } from '../types/auth.types';

const esquema = z.object({
  empresaId: z.string().min(1, 'Elige tu empresa.'),
  numeroEmpleado: z.string().trim().min(1, 'Escribe tu número de empleado.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

type Datos = z.infer<typeof esquema>;

// El dispositivo recuerda la empresa para no elegirla cada vez. Si el navegador
// no deja guardar (modo privado), el empleado solo la vuelve a elegir.
const CLAVE_EMPRESA = 'bonn_empresa_login';

function empresaRecordada(): string {
  try {
    return localStorage.getItem(CLAVE_EMPRESA) ?? '';
  } catch {
    return '';
  }
}

function recordarEmpresa(id: string): void {
  try {
    localStorage.setItem(CLAVE_EMPRESA, id);
  } catch {
    // Sin almacenamiento disponible
  }
}

// El numero de empleado solo es unico dentro de la empresa, por eso se pide la empresa (D-34)
export function FormularioLoginEmpleado({ alEntrar }: { alEntrar: (usuario: Perfil) => void }) {
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
  if (empresas.datos.length === 0) {
    return (
      <div className={styles.formulario}>
        <Alerta tono="info">Todavía no hay empresas registradas. Pide ayuda a tu administrador.</Alerta>
      </div>
    );
  }
  return <Campos empresas={empresas.datos} alEntrar={alEntrar} />;
}

// Se monta con la lista ya cargada para que la empresa recordada quede elegida desde el inicio
function Campos({ empresas, alEntrar }: { empresas: EmpresaLogin[]; alEntrar: (usuario: Perfil) => void }) {
  const iniciarSesionEmpleado = useAuthStore((s) => s.iniciarSesionEmpleado);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const recordada = empresaRecordada();
  const inicial = empresas.some((e) => e.id === recordada) ? recordada : empresas.length === 1 ? empresas[0].id : '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: { empresaId: inicial, numeroEmpleado: '', password: '' },
  });

  async function enviar({ empresaId, numeroEmpleado, password }: Datos) {
    setErrorServidor(null);
    try {
      const usuario = await iniciarSesionEmpleado(empresaId, numeroEmpleado, password);
      recordarEmpresa(empresaId);
      alEntrar(usuario);
    } catch (error) {
      setErrorServidor((error as ApiError).message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <Select
        etiqueta="Empresa"
        textoVacio="Elige tu empresa"
        opciones={empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }))}
        error={errors.empresaId?.message}
        {...register('empresaId')}
      />
      <Input
        etiqueta="Número de empleado"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="p. ej. 1024"
        error={errors.numeroEmpleado?.message}
        {...register('numeroEmpleado')}
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
