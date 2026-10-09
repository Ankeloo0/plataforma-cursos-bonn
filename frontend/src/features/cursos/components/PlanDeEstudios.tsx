import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CircleAlert, EyeOff, GripVertical, LoaderCircle, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { MenuAcciones, type Accion } from '../../../components/ui/MenuAcciones';
import type { Material, Tema } from '../types/contenido.types';
import { detalleMaterial, TIPOS_MATERIAL } from '../utils/material';
import styles from './PlanDeEstudios.module.css';

export interface PropsPlan {
  temas: Tema[];
  // Sin permiso de edicion: sin asas, sin agregar y solo la accion de ver
  editable: boolean;
  accionesTema: (tema: Tema) => Accion[];
  accionesMaterial: (material: Material) => Accion[];
  alAgregarMaterial: (tema: Tema) => void;
  alReordenarTemas: (ids: string[]) => void;
  alReordenarMateriales: (temaId: string, ids: string[]) => void;
}

// Plan de estudios del editor (brief del editor): cada tema es un bloque con sus materiales en orden.
// Los temas se reordenan entre si y los materiales dentro de su tema, arrastrando el asa.
// Con teclado: Espacio para tomar, flechas para mover y Espacio para soltar (KeyboardSensor de dnd-kit).
export function PlanDeEstudios({ temas, editable, alReordenarTemas, ...props }: PropsPlan) {
  const titulos = new Map(temas.map((t, i) => [t.id, `el tema ${i + 1}, ${t.titulo}`]));

  return (
    <ListaOrdenable ids={temas.map((t) => t.id)} nombres={titulos} alReordenar={alReordenarTemas} etiqueta="Temas del curso">
      {temas.map((tema, indice) => (
        <BloqueTema key={tema.id} tema={tema} numero={indice + 1} editable={editable} {...props} />
      ))}
    </ListaOrdenable>
  );
}

const INSTRUCCIONES =
  'Para mover, presiona Espacio o Enter. Usa las flechas arriba y abajo para cambiar el lugar, y Espacio o Enter para soltar. Escape cancela.';

// Una lista que se reordena arrastrando: los temas del curso o los materiales de un tema.
// Cada lista tiene su propio contexto, asi un material no puede pasar a otro tema.
function ListaOrdenable({
  ids,
  nombres,
  alReordenar,
  etiqueta,
  children,
}: {
  ids: string[];
  nombres: Map<string, string>;
  alReordenar: (ids: string[]) => void;
  etiqueta: string;
  children: ReactNode;
}) {
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // En pantallas tactiles hay que mantener presionada el asa, para no confundirlo con desplazar la pagina
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nombre = (id: UniqueIdentifier) => nombres.get(String(id)) ?? 'el elemento';
  const posicion = (id: UniqueIdentifier) => `posición ${ids.indexOf(String(id)) + 1} de ${ids.length}`;
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Tomaste ${nombre(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nombre(active.id)} está en la ${posicion(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Soltaste ${nombre(active.id)} en la ${posicion(over.id)}.` : `Soltaste ${nombre(active.id)}.`),
    onDragCancel: ({ active }) => `Cancelaste. ${nombre(active.id)} volvió a su lugar.`,
  };

  function alSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    alReordenar(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragEnd={alSoltar}
      accessibility={{ announcements: anuncios, screenReaderInstructions: { draggable: INSTRUCCIONES } }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={styles.lista} aria-label={etiqueta}>
          {children}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

// Asa para arrastrar: solo ella inicia el arrastre, asi los botones y menus del elemento siguen funcionando
function useOrdenable(id: string, etiqueta: string) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const asa = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={styles.asa}
      {...attributes}
      {...listeners}
      aria-label={etiqueta}
      aria-roledescription="elemento que se puede mover"
    >
      <GripVertical size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
  return {
    ref: setNodeRef,
    estilo: { transform: CSS.Translate.toString(transform), transition },
    arrastrando: isDragging,
    asa,
  };
}

function BloqueTema({
  tema,
  numero,
  editable,
  accionesTema,
  accionesMaterial,
  alAgregarMaterial,
  alReordenarMateriales,
}: Omit<PropsPlan, 'temas' | 'alReordenarTemas'> & { tema: Tema; numero: number }) {
  const { ref, estilo, arrastrando, asa } = useOrdenable(tema.id, `Mover el tema ${numero}, ${tema.titulo}`);
  const nombres = new Map(tema.materiales.map((m) => [m.id, m.titulo]));

  return (
    <li ref={ref} style={estilo} className={`${styles.tema} ${arrastrando ? styles.arrastrando : ''}`}>
      <div className={styles.cabeceraTema}>
        {editable && asa}
        <div className={`${styles.datosTema} ${tema.activo ? '' : styles.oculto}`}>
          <span className={`${styles.numero} cifras-tabulares`}>Tema {numero}</span>
          <h2 className={styles.tituloTema}>{tema.titulo}</h2>
        </div>
        {!tema.activo && (
          <Chip icono={EyeOff}>Oculto</Chip>
        )}
        {editable && <MenuAcciones etiqueta={`Acciones del tema ${tema.titulo}`} acciones={accionesTema(tema)} />}
      </div>

      {tema.materiales.length > 0 ? (
        <ListaOrdenable
          ids={tema.materiales.map((m) => m.id)}
          nombres={nombres}
          alReordenar={(ids) => alReordenarMateriales(tema.id, ids)}
          etiqueta={`Materiales del tema ${numero}`}
        >
          {tema.materiales.map((material) => (
            <FilaMaterial key={material.id} material={material} editable={editable} acciones={accionesMaterial(material)} />
          ))}
        </ListaOrdenable>
      ) : (
        <p className={styles.sinMateriales}>Sin materiales</p>
      )}

      {editable && (
        <div className={styles.pieTema}>
          <Button variante="texto" icono={Plus} onClick={() => alAgregarMaterial(tema)} aria-label={`Agregar material al tema ${numero}`}>
            Agregar material
          </Button>
        </div>
      )}
    </li>
  );
}

function FilaMaterial({ material, editable, acciones }: { material: Material; editable: boolean; acciones: Accion[] }) {
  const { ref, estilo, arrastrando, asa } = useOrdenable(material.id, `Mover ${material.titulo}`);
  const Icono = TIPOS_MATERIAL[material.tipo].icono;
  const estadoArchivo = material.archivo?.estado;

  return (
    <li ref={ref} style={estilo} className={`${styles.material} ${arrastrando ? styles.arrastrando : ''}`}>
      {editable && asa}
      <Icono className={styles.iconoTipo} size={20} strokeWidth={1.75} aria-hidden="true" />
      <div className={`${styles.datosMaterial} ${material.activo ? '' : styles.oculto}`}>
        <span className={styles.tituloMaterial}>{material.titulo}</span>
        <span className={`${styles.detalle} cifras-tabulares`}>{detalleMaterial(material)}</span>
      </div>
      <div className={styles.chips}>
        {!material.activo && <Chip icono={EyeOff}>Oculto</Chip>}
        {estadoArchivo === 'PROCESANDO' && (
          <Chip tono="info" icono={LoaderCircle}>
            Procesando
          </Chip>
        )}
        {estadoArchivo === 'ERROR' && (
          <Chip tono="critico" icono={CircleAlert}>
            Error
          </Chip>
        )}
      </div>
      {acciones.length > 0 && <MenuAcciones etiqueta={`Acciones de ${material.titulo}`} acciones={acciones} />}
    </li>
  );
}
