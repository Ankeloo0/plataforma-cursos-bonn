import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alerta } from '../../../components/ui/Alerta';
import { AreaTexto } from '../../../components/ui/AreaTexto';
import { Button } from '../../../components/ui/Button';
import formulario from '../../../components/ui/Formulario.module.css';
import { Input } from '../../../components/ui/Input';
import type { ApiError } from '../../../services/api/client';
import { useSubida } from '../hooks/useSubida';
import type { DatosMaterial, Material, TipoMaterial } from '../types/contenido.types';
import { esTipoArchivo, TIPOS_DISPONIBLES, TIPOS_MATERIAL, tituloDesdeArchivo } from '../utils/material';
import { CampoArchivo } from './CampoArchivo';
import styles from './FormularioMaterial.module.css';

export interface PropsFormularioMaterial {
  // Al editar, el tipo ya no cambia
  material?: Material;
  alGuardar: (tipo: TipoMaterial, datos: DatosMaterial) => Promise<void>;
  alCancelar: () => void;
  // El panel pide confirmar antes de cerrarse si hay una subida en curso
  alCambiarSubiendo: (subiendo: boolean) => void;
}

// Agregar o editar un material (RF-04.4). Primero se elige el tipo; al cambiarlo se empieza de nuevo.
export function FormularioMaterial({ material, ...props }: PropsFormularioMaterial) {
  const [tipo, setTipo] = useState<TipoMaterial | null>(material?.tipo ?? null);

  return (
    <div className={formulario.formulario}>
      {!material && (
        <fieldset className={styles.tipos}>
          <legend className={styles.leyenda}>Tipo de material</legend>
          <div className={styles.opciones}>
            {TIPOS_DISPONIBLES.map((opcion) => {
              const { etiqueta, icono: Icono, descripcion } = TIPOS_MATERIAL[opcion];
              return (
                <label key={opcion} className={styles.opcion}>
                  <input type="radio" name="tipo" value={opcion} checked={tipo === opcion} onChange={() => setTipo(opcion)} />
                  <Icono className={styles.icono} size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.nombreTipo}>{etiqueta}</span>
                  <span className={styles.descripcionTipo}>{descripcion}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {tipo ? (
        <CamposMaterial key={tipo} tipo={tipo} material={material} {...props} />
      ) : (
        <p className={formulario.aviso}>Elige qué vas a agregar.</p>
      )}
    </div>
  );
}

const MENSAJE_URL = 'Escribe una dirección completa que empiece con http:// o https://.';

function esquemaPara(tipo: TipoMaterial) {
  return z.object({
    titulo: z.string().trim().min(1, 'Escribe el título del material.').max(150, 'Máximo 150 caracteres.'),
    descripcion: z.string().trim().max(5000, 'Máximo 5000 caracteres.'),
    urlExterna:
      tipo === 'ENLACE'
        ? z.string().trim().max(500, 'Máximo 500 caracteres.').regex(/^https?:\/\/\S+$/i, MENSAJE_URL)
        : z.string(),
  });
}

type Valores = z.infer<ReturnType<typeof esquemaPara>>;

function CamposMaterial({
  tipo,
  material,
  alGuardar,
  alCancelar,
  alCambiarSubiendo,
}: PropsFormularioMaterial & { tipo: TipoMaterial }) {
  const subida = useSubida(tipo);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const conArchivo = esTipoArchivo(tipo);
  const subiendo = subida.estado.fase === 'subiendo';

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquemaPara(tipo)),
    mode: 'onBlur',
    defaultValues: {
      titulo: material?.titulo ?? '',
      descripcion: material?.descripcion ?? '',
      urlExterna: material?.urlExterna ?? '',
    },
  });

  useEffect(() => {
    alCambiarSubiendo(subiendo);
  }, [subiendo, alCambiarSubiendo]);

  function elegir(archivo: File) {
    // Como en Udemy: el nombre del archivo es el titulo inicial
    if (!getValues('titulo').trim()) setValue('titulo', tituloDesdeArchivo(archivo.name));
    void subida.elegir(archivo);
  }

  // Un material nuevo necesita su archivo subido; al editar, el archivo nuevo es opcional
  const faltaArchivo = conArchivo && !material && subida.estado.fase !== 'listo';
  const bloqueado = subiendo || subida.estado.fase === 'error' || faltaArchivo;
  const motivo = subiendo ? 'Espera a que termine la subida.' : 'Sube el archivo del material.';

  async function enviar(valores: Valores) {
    if (bloqueado) return;
    setErrorServidor(null);
    const datos: DatosMaterial = { titulo: valores.titulo, descripcion: valores.descripcion || null };
    if (tipo === 'ENLACE') datos.urlExterna = valores.urlExterna;
    if (subida.estado.fase === 'listo') datos.archivoId = subida.estado.subido.id;

    subida.marcarUsado(true);
    try {
      await alGuardar(tipo, datos);
    } catch (error) {
      subida.marcarUsado(false);
      // Incluye CURSO_MODIFICADO (V-13): el mensaje ya pide recargar
      setErrorServidor((error as ApiError).message);
    }
  }

  return (
    <form className={formulario.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      {esTipoArchivo(tipo) && (
        <CampoArchivo
          tipo={tipo}
          estado={subida.estado}
          actual={material?.archivo}
          alElegir={elegir}
          alCancelar={subida.cancelar}
          alReintentar={subida.reintentar}
        />
      )}
      {tipo === 'ENLACE' && (
        <Input
          etiqueta="Dirección"
          required
          type="url"
          inputMode="url"
          placeholder="p. ej. https://www.ejemplo.com/manual"
          autoComplete="off"
          error={errors.urlExterna?.message}
          {...register('urlExterna')}
        />
      )}
      <Input etiqueta="Título" required autoComplete="off" error={errors.titulo?.message} {...register('titulo')} />
      <AreaTexto
        etiqueta="Descripción"
        rows={3}
        ayuda="Opcional. Qué va a encontrar el empleado en este material."
        error={errors.descripcion?.message}
        {...register('descripcion')}
      />
      {errorServidor && <Alerta>{errorServidor}</Alerta>}
      <div className={formulario.acciones}>
        <Button type="submit" cargando={isSubmitting} textoCargando="Guardando…" disabled={bloqueado} motivoDeshabilitado={motivo}>
          {material ? 'Guardar cambios' : 'Agregar material'}
        </Button>
        <Button variante="secundario" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
      {bloqueado && !isSubmitting && (
        <p className={formulario.aviso} aria-live="polite">
          {subida.estado.fase === 'error' ? 'Resuelve el problema del archivo para guardar.' : motivo}
        </p>
      )}
    </form>
  );
}
