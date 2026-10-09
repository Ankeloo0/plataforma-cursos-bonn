import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { AreaTexto } from '../../../components/ui/AreaTexto';
import { Button } from '../../../components/ui/Button';
import formulario from '../../../components/ui/Formulario.module.css';
import { Input } from '../../../components/ui/Input';
import type { ApiError } from '../../../services/api/client';
import type { DatosTema, Tema } from '../types/contenido.types';

const esquema = z.object({
  titulo: z.string().trim().min(1, 'Escribe el título del tema.').max(150, 'Máximo 150 caracteres.'),
  descripcion: z.string().trim().max(5000, 'Máximo 5000 caracteres.'),
});

type Valores = z.infer<typeof esquema>;

// Agregar o editar un tema (RF-04.3)
export function FormularioTema({
  tema,
  alGuardar,
  alCancelar,
}: {
  tema?: Tema;
  alGuardar: (datos: DatosTema) => Promise<void>;
  alCancelar: () => void;
}) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: { titulo: tema?.titulo ?? '', descripcion: tema?.descripcion ?? '' },
  });

  async function enviar(valores: Valores) {
    setErrorServidor(null);
    try {
      await alGuardar({ titulo: valores.titulo, descripcion: valores.descripcion || null });
    } catch (error) {
      setErrorServidor((error as ApiError).message);
    }
  }

  return (
    <form className={formulario.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <Input etiqueta="Título" required autoComplete="off" error={errors.titulo?.message} {...register('titulo')} />
      <AreaTexto
        etiqueta="Descripción"
        rows={4}
        ayuda="Opcional. De qué trata el tema."
        error={errors.descripcion?.message}
        {...register('descripcion')}
      />
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={formulario.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…">
          {tema ? 'Guardar cambios' : 'Agregar tema'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
