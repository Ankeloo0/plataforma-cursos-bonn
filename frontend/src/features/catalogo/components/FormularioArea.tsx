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
import type { Area, DatosArea } from '../types/catalogo.types';
import { textoUso } from '../utils/uso';

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del área.').max(100, 'Máximo 100 caracteres.'),
  descripcion: z.string().trim().max(500, 'Máximo 500 caracteres.'),
});

type Datos = z.infer<typeof esquema>;

export function FormularioArea({
  area,
  alGuardar,
  alCancelar,
}: {
  area?: Area;
  alGuardar: (datos: DatosArea) => Promise<void>;
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
    defaultValues: { nombre: area?.nombre ?? '', descripcion: area?.descripcion ?? '' },
  });

  async function enviar(datos: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar({ nombre: datos.nombre, descripcion: datos.descripcion || null });
    } catch (error) {
      const { code, message } = error as ApiError;
      if (code === 'AREA_NOMBRE_DUPLICADO') setError('nombre', { message }, { shouldFocus: true });
      else setErrorServidor(message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <p className={styles.nota}>Los campos con * son obligatorios.</p>
      {/* RN-02.6: el catalogo es el mismo para todas las empresas */}
      {area && area.uso.empleados > 0 && (
        <p className={styles.aviso} role="status">
          El cambio se verá en todas las empresas. Hoy la usan {textoUso(area.uso).toLowerCase()}.
        </p>
      )}
      <Input etiqueta="Nombre" required placeholder="p. ej. Servicio" ayuda="Único en la plataforma." error={errors.nombre?.message} {...register('nombre')} />
      <AreaTexto etiqueta="Descripción" rows={3} error={errors.descripcion?.message} {...register('descripcion')} />
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={styles.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {area ? 'Guardar cambios' : 'Crear área'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
