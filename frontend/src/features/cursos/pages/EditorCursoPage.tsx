import { Clock, ExternalLink, Eye, EyeOff, Layers, ListTree, Pencil, Plus, RotateCw, Settings2, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { Dialogo } from '../../../components/ui/Dialogo';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import type { Accion } from '../../../components/ui/MenuAcciones';
import pagina from '../../../components/ui/Pagina.module.css';
import { PanelLateral } from '../../../components/ui/PanelLateral';
import { Skeleton } from '../../../components/ui/Skeleton';
import { mostrarToast } from '../../../components/ui/toast.store';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import { FormularioCurso, type CambiosCurso } from '../components/FormularioCurso';
import { FormularioMaterial } from '../components/FormularioMaterial';
import { FormularioTema } from '../components/FormularioTema';
import { PlanDeEstudios } from '../components/PlanDeEstudios';
import { contenidoService } from '../services/contenido.service';
import { cursosService } from '../services/cursos.service';
import type { DatosMaterial, DatosTema, Material, Tema, TipoMaterial } from '../types/contenido.types';
import { duracion, ESTADO_CURSO, guardarPortada } from '../utils/curso';
import styles from './EditorCursoPage.module.css';

type Panel =
  | { tipo: 'curso' }
  | { tipo: 'tema'; tema?: Tema }
  | { tipo: 'material'; tema: Tema; material?: Material }
  | null;

type Confirmacion = { tipo: 'tema'; tema: Tema } | { tipo: 'material'; material: Material } | null;

// Editor de contenido del curso (RF-04.3, RF-04.4; brief en .impeccable/surfaces). Cada cambio se guarda
// al momento y recalcula la duracion del curso, asi que despues de cada uno se vuelven a pedir los datos.
export function EditorCursoPage() {
  const { id = '' } = useParams();
  const curso = useConsulta(useCallback(() => cursosService.obtener(id), [id]));
  const temas = useConsulta(useCallback(() => contenidoService.listarTemas(id), [id]));

  const [panel, setPanel] = useState<Panel>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<ApiError | null>(null);
  // Con una subida en curso, cerrar el panel pide confirmar
  const [subiendo, setSubiendo] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const recargarTodo = () => {
    curso.recargar();
    temas.recargar();
  };

  const cerrarPanel = () => {
    setPanel(null);
    setSubiendo(false);
    setConfirmarCierre(false);
  };
  const pedirCierre = () => (subiendo ? setConfirmarCierre(true) : cerrarPanel());

  // Acciones del menu: un error se muestra arriba del plan, con la opcion de recargar
  async function ejecutar(accion: () => Promise<void>, mensaje: string) {
    setErrorAccion(null);
    try {
      await accion();
      mostrarToast(mensaje);
    } catch (error) {
      setErrorAccion(error as ApiError);
    }
    recargarTodo();
  }

  async function reordenarTemas(ids: string[]) {
    const anteriores = temas.datos!;
    // Se ve el orden nuevo al soltar; si la API falla, vuelve al anterior
    temas.reemplazar(ids.map((temaId) => anteriores.find((t) => t.id === temaId)!));
    setErrorAccion(null);
    try {
      await contenidoService.reordenarTemas(id, ids);
      curso.recargar();
    } catch (error) {
      temas.reemplazar(anteriores);
      setErrorAccion(error as ApiError);
    }
  }

  async function reordenarMateriales(temaId: string, ids: string[]) {
    const anteriores = temas.datos!;
    temas.reemplazar(
      anteriores.map((t) => (t.id === temaId ? { ...t, materiales: ids.map((mId) => t.materiales.find((m) => m.id === mId)!) } : t)),
    );
    setErrorAccion(null);
    try {
      await contenidoService.reordenarMateriales(temaId, ids);
      curso.recargar();
    } catch (error) {
      temas.reemplazar(anteriores);
      setErrorAccion(error as ApiError);
    }
  }

  async function guardarCurso({ datos, portada }: CambiosCurso) {
    await cursosService.actualizar(id, datos, curso.datos!.actualizadoEn);
    await guardarPortada(id, portada);
    cerrarPanel();
    curso.recargar();
    mostrarToast('Curso actualizado');
  }

  async function guardarTema(tema: Tema | undefined, datos: DatosTema) {
    if (tema) await contenidoService.actualizarTema(tema.id, datos, tema.actualizadoEn);
    else await contenidoService.crearTema(id, datos);
    cerrarPanel();
    recargarTodo();
    mostrarToast(tema ? 'Tema actualizado' : 'Tema agregado');
  }

  async function guardarMaterial(tema: Tema, material: Material | undefined, tipo: TipoMaterial, datos: DatosMaterial) {
    if (material) await contenidoService.actualizarMaterial(material.id, datos, material.actualizadoEn);
    else await contenidoService.crearMaterial(tema.id, tipo, datos);
    cerrarPanel();
    recargarTodo();
    mostrarToast(material ? 'Material actualizado' : 'Material agregado');
  }

  async function confirmarEliminacion() {
    if (!confirmacion) return;
    setEliminando(true);
    setErrorConfirmacion(null);
    try {
      if (confirmacion.tipo === 'tema') await contenidoService.eliminarTema(confirmacion.tema.id);
      else await contenidoService.eliminarMaterial(confirmacion.material.id);
      setConfirmacion(null);
      mostrarToast(confirmacion.tipo === 'tema' ? 'Tema eliminado' : 'Material eliminado');
      recargarTodo();
    } catch (error) {
      setErrorConfirmacion((error as ApiError).message);
    } finally {
      setEliminando(false);
    }
  }

  const accionesTema = (tema: Tema): Accion[] => [
    { etiqueta: 'Editar tema', icono: Pencil, alElegir: () => setPanel({ tipo: 'tema', tema }) },
    tema.activo
      ? {
          etiqueta: 'Ocultar',
          icono: EyeOff,
          alElegir: () => ejecutar(() => contenidoService.cambiarVisibilidadTema(tema.id, false), 'Tema oculto: ya no cuenta en la duración'),
        }
      : { etiqueta: 'Mostrar', icono: Eye, alElegir: () => ejecutar(() => contenidoService.cambiarVisibilidadTema(tema.id, true), 'Tema visible') },
    { etiqueta: 'Eliminar tema', icono: Trash2, peligro: true, alElegir: () => setConfirmacion({ tipo: 'tema', tema }) },
  ];

  const abrirMaterial = (material: Material): Accion[] => {
    const url = material.archivo?.url ?? material.urlExterna;
    return url ? [{ etiqueta: 'Abrir', icono: ExternalLink, alElegir: () => window.open(url, '_blank', 'noopener') }] : [];
  };

  const accionesMaterial = (material: Material): Accion[] => {
    if (!curso.datos?.puedeEditar) return abrirMaterial(material);
    const tema = temas.datos!.find((t) => t.id === material.temaId)!;
    return [
      ...abrirMaterial(material),
      { etiqueta: 'Editar material', icono: Pencil, alElegir: () => setPanel({ tipo: 'material', tema, material }) },
      material.activo
        ? {
            etiqueta: 'Ocultar',
            icono: EyeOff,
            alElegir: () =>
              ejecutar(() => contenidoService.cambiarVisibilidadMaterial(material.id, false), 'Material oculto: ya no cuenta en la duración'),
          }
        : {
            etiqueta: 'Mostrar',
            icono: Eye,
            alElegir: () => ejecutar(() => contenidoService.cambiarVisibilidadMaterial(material.id, true), 'Material visible'),
          },
      { etiqueta: 'Eliminar material', icono: Trash2, peligro: true, alElegir: () => setConfirmacion({ tipo: 'material', material }) },
    ];
  };

  if (curso.estado === 'error' && !curso.datos) {
    return (
      <div className={pagina.errorCarga}>
        <Alerta>{curso.error.statusCode === 404 ? 'Este curso no existe o no puedes verlo.' : curso.error.message}</Alerta>
        <Link to="/cursos">Volver a cursos</Link>
      </div>
    );
  }

  const datos = curso.datos;
  const lista = temas.datos;
  const editable = datos?.puedeEditar ?? false;
  const estado = datos ? ESTADO_CURSO[datos.estado] : null;
  const botonTema = (
    <Button icono={Plus} onClick={() => setPanel({ tipo: 'tema' })}>
      Agregar tema
    </Button>
  );

  return (
    <>
      <nav aria-label="Ruta" className={pagina.migas}>
        <ol>
          <li>
            <Link to="/cursos">Cursos</Link>
          </li>
          <li aria-current="page">{datos?.titulo ?? '…'}</li>
        </ol>
      </nav>

      {!datos || !estado ? (
        <div className={styles.cargando} aria-busy="true" aria-label="Cargando curso">
          <Skeleton ancho={420} alto={44} />
          <Skeleton ancho={280} alto={24} />
        </div>
      ) : (
        <header className={styles.encabezado}>
          <div className={styles.identidad}>
            <h1 className="titulo-pagina">{datos.titulo}</h1>
            <div className={styles.resumen}>
              <Chip tono={estado.tono} icono={estado.icono}>
                {estado.etiqueta}
              </Chip>
              <span className={styles.dato}>
                <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className="cifras-tabulares">{datos.duracionHoras > 0 ? duracion(datos.duracionHoras) : 'Sin duración'}</span>
              </span>
              {lista && (
                <span className={styles.dato}>
                  <Layers size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className="cifras-tabulares">{lista.length === 1 ? '1 tema' : `${lista.length} temas`}</span>
                </span>
              )}
              {!editable && <span className={styles.dato}>Solo consulta</span>}
            </div>
          </div>
          {editable && (
            <Button variante="secundario" icono={Settings2} onClick={() => setPanel({ tipo: 'curso' })}>
              Datos del curso
            </Button>
          )}
        </header>
      )}

      {errorAccion && (
        <div className={pagina.errorCarga}>
          <Alerta>{errorAccion.message}</Alerta>
          <Button variante="secundario" icono={RotateCw} onClick={() => { setErrorAccion(null); recargarTodo(); }}>
            Recargar
          </Button>
        </div>
      )}

      {temas.estado === 'error' && !lista && (
        <div className={pagina.errorCarga}>
          <Alerta>{temas.error.message}</Alerta>
          <Button variante="secundario" icono={RotateCw} onClick={temas.recargar}>
            Reintentar
          </Button>
        </div>
      )}

      {!lista && temas.estado === 'cargando' && (
        <div className={styles.cargandoPlan} aria-busy="true" aria-label="Cargando temas">
          {[1, 2].map((n) => (
            <Skeleton key={n} alto={180} />
          ))}
        </div>
      )}

      {lista && lista.length === 0 && (
        <EstadoVacio icono={ListTree} titulo="Este curso todavía no tiene temas" accion={editable ? botonTema : undefined}>
          <p>
            {editable
              ? 'Organiza el curso en temas y agrega a cada uno sus videos, PDF, imágenes, documentos o enlaces. La duración se calcula sola con los videos.'
              : 'Cuando se le agreguen temas, aparecerán aquí.'}
          </p>
        </EstadoVacio>
      )}

      {lista && lista.length > 0 && (
        <section className={styles.plan} aria-label="Plan de estudios" aria-busy={temas.estado === 'cargando'}>
          <PlanDeEstudios
            temas={lista}
            editable={editable}
            accionesTema={accionesTema}
            accionesMaterial={accionesMaterial}
            alAgregarMaterial={(tema) => setPanel({ tipo: 'material', tema })}
            alReordenarTemas={reordenarTemas}
            alReordenarMateriales={reordenarMateriales}
          />
          {editable && <div className={styles.agregarTema}>{botonTema}</div>}
        </section>
      )}

      <PanelLateral abierto={panel?.tipo === 'curso'} titulo="Datos del curso" alCerrar={cerrarPanel}>
        {panel?.tipo === 'curso' && datos && <FormularioCurso curso={datos} alGuardar={guardarCurso} alCancelar={cerrarPanel} />}
      </PanelLateral>

      <PanelLateral
        abierto={panel?.tipo === 'tema'}
        titulo={panel?.tipo === 'tema' && panel.tema ? 'Editar tema' : 'Nuevo tema'}
        descripcion={panel?.tipo === 'tema' && !panel.tema ? 'Se agrega al final del curso; después puedes moverlo.' : undefined}
        alCerrar={cerrarPanel}
      >
        {panel?.tipo === 'tema' && (
          <FormularioTema tema={panel.tema} alGuardar={(d) => guardarTema(panel.tema, d)} alCancelar={cerrarPanel} />
        )}
      </PanelLateral>

      <PanelLateral
        abierto={panel?.tipo === 'material'}
        titulo={panel?.tipo === 'material' && panel.material ? 'Editar material' : 'Nuevo material'}
        descripcion={panel?.tipo === 'material' ? `Tema: ${panel.tema.titulo}` : undefined}
        alCerrar={pedirCierre}
      >
        {panel?.tipo === 'material' && (
          <FormularioMaterial
            material={panel.material}
            alGuardar={(tipo, d) => guardarMaterial(panel.tema, panel.material, tipo, d)}
            alCancelar={pedirCierre}
            alCambiarSubiendo={setSubiendo}
          />
        )}
      </PanelLateral>

      <Dialogo
        abierto={confirmarCierre}
        titulo="¿Cancelar la subida?"
        textoConfirmar="Cancelar subida"
        textoCancelar="Seguir subiendo"
        peligro
        alConfirmar={cerrarPanel}
        alCancelar={() => setConfirmarCierre(false)}
      >
        <p>El archivo dejará de subirse y el material no se guardará.</p>
      </Dialogo>

      <Dialogo
        abierto={confirmacion !== null}
        titulo={confirmacion?.tipo === 'tema' ? `¿Eliminar el tema "${confirmacion.tema.titulo}"?` : '¿Eliminar este material?'}
        textoConfirmar={confirmacion?.tipo === 'tema' ? 'Eliminar tema' : 'Eliminar material'}
        textoCargando="Eliminando…"
        peligro
        cargando={eliminando}
        error={errorConfirmacion}
        alConfirmar={confirmarEliminacion}
        alCancelar={() => {
          setConfirmacion(null);
          setErrorConfirmacion(null);
        }}
      >
        {confirmacion?.tipo === 'tema' ? (
          <p>
            {confirmacion.tema.materiales.length > 0
              ? `Se eliminan también ${confirmacion.tema.materiales.length === 1 ? 'su material' : `sus ${confirmacion.tema.materiales.length} materiales`} y sus archivos. No se puede deshacer.`
              : 'No se puede deshacer.'}
          </p>
        ) : (
          <p>Se elimina "{confirmacion?.material.titulo}" con su archivo. No se puede deshacer. Si solo quieres que deje de verse, ocúltalo.</p>
        )}
      </Dialogo>
    </>
  );
}
