import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import styles from '../../../components/ui/Formulario.module.css';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { ApiError } from '../../../services/api/client';
import type { Marca } from '../../marcas/types/marcas.types';
import type { DatosSucursal, Sucursal } from '../types/empresas.types';

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la sucursal.').max(120, 'Máximo 120 caracteres.'),
  marcaId: z.string().min(1, 'Elige la marca que vende la sucursal.'),
  direccion: z.string().trim().max(250, 'Máximo 250 caracteres.'),
});

type Datos = z.infer<typeof esquema>;

export function FormularioSucursal({
  sucursal,
  marcas,
  alGuardar,
  alCancelar,
}: {
  sucursal?: Sucursal;
  marcas: Marca[];
  alGuardar: (datos: DatosSucursal) => Promise<void>;
  alCancelar: () => void;
}) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: { nombre: sucursal?.nombre ?? '', marcaId: sucursal?.marca.id ?? '', direccion: sucursal?.direccion ?? '' },
  });
  const marcaElegida = useWatch({ control, name: 'marcaId' });
  const cambiaDeMarca = sucursal !== undefined && marcaElegida !== sucursal.marca.id;

  // Las marcas inactivas no se ofrecen, salvo la que ya tiene la sucursal
  const opciones = marcas
    .filter((m) => m.activo || m.id === sucursal?.marca.id)
    .map((m) => ({ valor: m.id, etiqueta: m.activo ? m.nombre : `${m.nombre} (inactiva)` }));

  async function enviar(datos: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar({ nombre: datos.nombre, marcaId: datos.marcaId, direccion: datos.direccion || null });
    } catch (error) {
      const { code, message } = error as ApiError;
      if (code === 'SUCURSAL_NOMBRE_DUPLICADO') setError('nombre', { message }, { shouldFocus: true });
      else if (code === 'MARCA_INACTIVA' || code === 'MARCA_NO_ENCONTRADA') setError('marcaId', { message }, { shouldFocus: true });
      else setErrorServidor(message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <p className={styles.nota}>Los campos con * son obligatorios.</p>
      <Input
        etiqueta="Nombre"
        required
        placeholder="p. ej. Volkswagen Bonn Oaxaca"
        ayuda="Único dentro de la empresa."
        error={errors.nombre?.message}
        {...register('nombre')}
      />
      <Select
        etiqueta="Marca"
        required
        textoVacio="Elige una marca"
        opciones={opciones}
        ayuda="Una sucursal vende una sola marca. Sus empleados reciben los cursos de esa marca."
        error={errors.marcaId?.message}
        {...register('marcaId')}
      />
      {cambiaDeMarca && (
        <p className={styles.aviso} role="status">
          Al cambiar la marca, los {sucursal.empleadosActivos} empleados de esta sucursal dejarán de tener pendientes los
          cursos de {sucursal.marca.nombre} y recibirán los de la marca nueva.
        </p>
      )}
      <Input
        etiqueta="Dirección"
        placeholder="p. ej. Av. Universidad 801, Exhacienda Candiani, Oaxaca de Juárez"
        error={errors.direccion?.message}
        {...register('direccion')}
      />
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={styles.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {sucursal ? 'Guardar cambios' : 'Crear sucursal'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
