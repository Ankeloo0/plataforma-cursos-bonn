import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { AreaTexto } from '../../../components/ui/AreaTexto';
import { Button } from '../../../components/ui/Button';
import formulario from '../../../components/ui/Formulario.module.css';
import { Input } from '../../../components/ui/Input';
import type { ApiError } from '../../../services/api/client';
import type { Curso, DatosCurso } from '../types/cursos.types';
import { CampoPortada } from './CampoPortada';
import styles from './FormularioCurso.module.css';

// Se acepta coma o punto decimal: "80,5" y "80.5" son lo mismo
const aNumero = (texto: string) => Number(texto.trim().replace(',', '.'));

const esquema = z.object({
  titulo: z.string().trim().min(1, 'Escribe el título del curso.').max(150, 'Máximo 150 caracteres.'),
  descripcion: z.string().trim().max(5000, 'Máximo 5000 caracteres.'),
  esObligatorio: z.boolean(),
  fechaLimite: z.string(),
  calificacionMinima: z
    .string()
    .trim()
    .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'Escribe un número de 0 a 100.')
    .refine((valor) => aNumero(valor) <= 100, 'La calificación mínima va de 0 a 100.'),
});

type Datos = z.infer<typeof esquema>;

export interface CambiosCurso {
  datos: DatosCurso;
  // undefined = sin cambios; File = portada nueva; null = quitarla
  portada: File | null | undefined;
}

// Crear y editar los datos generales de un curso (RF-04.1). Temas y materiales van en su editor.
// La duracion no se captura: la calcula el sistema con la duracion de sus videos (D-36).
export function FormularioCurso({
  curso,
  alGuardar,
  alCancelar,
}: {
  curso?: Curso;
  alGuardar: (cambios: CambiosCurso) => Promise<void>;
  alCancelar: () => void;
}) {
  const [portada, setPortada] = useState<File | null | undefined>(undefined);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: {
      titulo: curso?.titulo ?? '',
      descripcion: curso?.descripcion ?? '',
      esObligatorio: curso?.esObligatorio ?? false,
      fechaLimite: curso?.fechaLimite ?? '',
      calificacionMinima: curso ? String(curso.calificacionMinima) : '80',
    },
  });
  const titulo = useWatch({ control, name: 'titulo' });

  async function enviar(valores: Datos) {
    setErrorServidor(null);
    try {
      await alGuardar({
        datos: {
          titulo: valores.titulo,
          descripcion: valores.descripcion || null,
          esObligatorio: valores.esObligatorio,
          fechaLimite: valores.fechaLimite || null,
          calificacionMinima: aNumero(valores.calificacionMinima),
        },
        portada,
      });
    } catch (error) {
      // Incluye CURSO_MODIFICADO (V-13): el mensaje ya pide recargar
      setErrorServidor((error as ApiError).message);
    }
  }

  return (
    <form className={formulario.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <p className={formulario.nota}>Los campos con * son obligatorios.</p>
      <Input etiqueta="Título" required autoComplete="off" error={errors.titulo?.message} {...register('titulo')} />
      <AreaTexto etiqueta="Descripción" rows={4} error={errors.descripcion?.message} {...register('descripcion')} />
      <CampoPortada titulo={titulo} portadaActual={curso?.portadaUrl ?? null} valor={portada} alCambiar={setPortada} />
      <Input
        etiqueta="Calificación mínima"
        required
        inputMode="decimal"
        autoComplete="off"
        ayuda="De 0 a 100. La misma para todas las evaluaciones del curso."
        error={errors.calificacionMinima?.message}
        {...register('calificacionMinima')}
      />
      <p className={formulario.aviso}>La duración del curso se calcula sola con la duración de sus videos.</p>
      <Input
        etiqueta="Fecha límite"
        type="date"
        ayuda="Opcional. Fecha en que los empleados deben terminarlo."
        error={errors.fechaLimite?.message}
        {...register('fechaLimite')}
      />
      <label className={styles.casilla}>
        <input type="checkbox" {...register('esObligatorio')} />
        <span>
          <span className={styles.casillaNombre}>Curso obligatorio</span>
          <span className={styles.casillaDescripcion}>Se muestra marcado como obligatorio y primero en el catálogo del empleado.</span>
        </span>
      </label>
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={formulario.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {curso ? 'Guardar cambios' : 'Crear curso'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
