import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { AreaTexto } from '../../../components/ui/AreaTexto';
import { Button } from '../../../components/ui/Button';
import styles from '../../../components/ui/Formulario.module.css';
import { Input } from '../../../components/ui/Input';
import type { ApiError } from '../../../services/api/client';
import type { DatosMarca, Marca } from '../types/marcas.types';

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la marca.').max(80, 'Máximo 80 caracteres.'),
  instruccionesAsistente: z.string().trim().max(4000, 'Máximo 4000 caracteres.'),
});

type Datos = z.infer<typeof esquema>;

export function FormularioMarca({
  marca,
  alGuardar,
  alCancelar,
}: {
  marca?: Marca;
  alGuardar: (datos: DatosMarca) => Promise<void>;
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
    defaultValues: { nombre: marca?.nombre ?? '', instruccionesAsistente: marca?.instruccionesAsistente ?? '' },
  });

  async function enviar(datos: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar({ nombre: datos.nombre, instruccionesAsistente: datos.instruccionesAsistente || null });
    } catch (error) {
      const { code, message } = error as ApiError;
      if (code === 'MARCA_NOMBRE_DUPLICADO') setError('nombre', { message }, { shouldFocus: true });
      else setErrorServidor(message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <p className={styles.nota}>Los campos con * son obligatorios.</p>
      {marca && marca.sucursales > 0 && (
        <p className={styles.aviso} role="status">
          Los cambios afectan a {marca.sucursales} {marca.sucursales === 1 ? 'sucursal' : 'sucursales'} de {marca.empresas}{' '}
          {marca.empresas === 1 ? 'empresa' : 'empresas'}.
        </p>
      )}
      <Input etiqueta="Nombre" required placeholder="p. ej. Volkswagen" ayuda="Único en la plataforma." error={errors.nombre?.message} {...register('nombre')} />
      <AreaTexto
        etiqueta="Instrucciones del asistente para esta marca"
        placeholder="p. ej. Usa los nombres de los modelos y servicios de la marca."
        ayuda="Se agregan a las instrucciones generales cuando pregunta un empleado de una sucursal de esta marca."
        error={errors.instruccionesAsistente?.message}
        {...register('instruccionesAsistente')}
      />
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={styles.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {marca ? 'Guardar cambios' : 'Crear marca'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
