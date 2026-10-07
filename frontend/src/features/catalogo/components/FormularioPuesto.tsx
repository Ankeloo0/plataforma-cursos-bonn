import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { AreaTexto } from '../../../components/ui/AreaTexto';
import { Button } from '../../../components/ui/Button';
import styles from '../../../components/ui/Formulario.module.css';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { ApiError } from '../../../services/api/client';
import type { Area, DatosPuesto, Puesto } from '../types/catalogo.types';
import { textoUso } from '../utils/uso';

const esquema = z.object({
  areaId: z.string().min(1, 'Elige el área del puesto.'),
  nombre: z.string().trim().min(1, 'Escribe el nombre del puesto.').max(100, 'Máximo 100 caracteres.'),
  descripcion: z.string().trim().max(500, 'Máximo 500 caracteres.'),
});

type Datos = z.infer<typeof esquema>;

// Un puesto solo se crea o se mueve a un area activa
export function FormularioPuesto({
  puesto,
  areas,
  areaInicial,
  alGuardar,
  alCancelar,
}: {
  puesto?: Puesto;
  areas: Area[];
  areaInicial?: string;
  alGuardar: (datos: DatosPuesto) => Promise<void>;
  alCancelar: () => void;
}) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const opciones = areas.filter((a) => a.activo || a.id === puesto?.area.id).map((a) => ({ valor: a.id, etiqueta: a.nombre }));
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: {
      areaId: puesto?.area.id ?? areaInicial ?? '',
      nombre: puesto?.nombre ?? '',
      descripcion: puesto?.descripcion ?? '',
    },
  });

  async function enviar(datos: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar({ areaId: datos.areaId, nombre: datos.nombre, descripcion: datos.descripcion || null });
    } catch (error) {
      const { code, message } = error as ApiError;
      if (code === 'PUESTO_NOMBRE_DUPLICADO') setError('nombre', { message }, { shouldFocus: true });
      else if (code === 'AREA_INACTIVA' || code === 'AREA_NO_ENCONTRADA') setError('areaId', { message }, { shouldFocus: true });
      else setErrorServidor(message);
    }
  }

  return (
    <form className={styles.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <p className={styles.nota}>Los campos con * son obligatorios.</p>
      {puesto && puesto.uso.empleados > 0 && (
        <p className={styles.aviso} role="status">
          El cambio se verá en todas las empresas. Hoy lo usan {textoUso(puesto.uso).toLowerCase()}.
        </p>
      )}
      <Select
        etiqueta="Área"
        required
        textoVacio="Elige un área"
        opciones={opciones}
        error={errors.areaId?.message}
        {...register('areaId')}
      />
      <Input
        etiqueta="Nombre"
        required
        placeholder="p. ej. Asesor de servicio"
        ayuda="Único dentro de su área. Es el tipo de empleado: define qué cursos recibe."
        error={errors.nombre?.message}
        {...register('nombre')}
      />
      <AreaTexto etiqueta="Descripción" rows={3} error={errors.descripcion?.message} {...register('descripcion')} />
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={styles.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {puesto ? 'Guardar cambios' : 'Crear puesto'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
