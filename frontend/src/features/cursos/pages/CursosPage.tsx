import { BookOpen, Plus, RotateCw, SearchX } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { CampoBusqueda } from '../../../components/ui/CampoBusqueda';
import { ChipsFiltro } from '../../../components/ui/ChipsFiltro';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import pagina from '../../../components/ui/Pagina.module.css';
import { Paginacion } from '../../../components/ui/Paginacion';
import { PanelLateral } from '../../../components/ui/PanelLateral';
import { Skeleton } from '../../../components/ui/Skeleton';
import { mostrarToast } from '../../../components/ui/toast.store';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import { puede } from '../../../utils/permisos';
import { useAuthStore } from '../../auth/stores/auth.store';
import { FormularioCurso, type CambiosCurso } from '../components/FormularioCurso';
import { TarjetaCurso } from '../components/TarjetaCurso';
import { cursosService } from '../services/cursos.service';
import type { Curso, FiltrosCursos } from '../types/cursos.types';
import styles from './CursosPage.module.css';

const OPCIONES_ESTADO: { valor: FiltrosCursos['estado']; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'BORRADOR', etiqueta: 'Borradores' },
  { valor: 'PUBLICADO', etiqueta: 'Publicados' },
  { valor: 'ARCHIVADO', etiqueta: 'Archivados' },
];

const ESTADOS = ['BORRADOR', 'PUBLICADO', 'ARCHIVADO'];

function leerFiltros(params: URLSearchParams): FiltrosCursos {
  const estado = params.get('estado') ?? '';
  return {
    page: Number(params.get('page')) || 1,
    limit: Number(params.get('limit')) || 20,
    search: params.get('search') ?? '',
    estado: ESTADOS.includes(estado) ? (estado as FiltrosCursos['estado']) : 'todos',
  };
}

// La portada se sube despues de guardar los datos: si falla, los datos ya quedaron guardados
async function guardarPortada(cursoId: string, portada: File | null | undefined): Promise<void> {
  if (portada === undefined) return;
  try {
    if (portada) await cursosService.cambiarPortada(cursoId, portada);
    else await cursosService.quitarPortada(cursoId);
  } catch (error) {
    mostrarToast(`Los datos se guardaron, pero la portada no: ${(error as ApiError).message}`, 'critico');
  }
}

type Accion = { tipo: 'nuevo' } | { tipo: 'editar'; curso: Curso } | null;

// Catalogo de cursos del administrador (RF-04.1, RF-04.9). Los filtros viven en la URL.
export function CursosPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => leerFiltros(params), [params]);
  const hayFiltros = filtros.search !== '' || filtros.estado !== 'todos';
  const [accion, setAccion] = useState<Accion>(null);

  const consulta = useConsulta(useCallback(() => cursosService.listar(filtros), [filtros]));
  const gestionar = puede(usuario, 'CURSOS_GESTIONAR');

  const cambiarFiltros = useCallback(
    (cambios: Partial<FiltrosCursos>) => {
      const siguientes = { ...filtros, page: 1, ...cambios };
      const nuevos = new URLSearchParams();
      if (siguientes.page > 1) nuevos.set('page', String(siguientes.page));
      if (siguientes.limit !== 20) nuevos.set('limit', String(siguientes.limit));
      if (siguientes.search) nuevos.set('search', siguientes.search);
      if (siguientes.estado !== 'todos') nuevos.set('estado', siguientes.estado);
      setParams(nuevos, { replace: true });
    },
    [filtros, setParams],
  );
  const buscar = useCallback((search: string) => cambiarFiltros({ search }), [cambiarFiltros]);

  async function crear({ datos, portada }: CambiosCurso) {
    const creado = await cursosService.crear(datos);
    await guardarPortada(creado.id, portada);
    setAccion(null);
    consulta.recargar();
    mostrarToast('Curso creado en borrador');
  }

  async function editar(curso: Curso, { datos, portada }: CambiosCurso) {
    await cursosService.actualizar(curso.id, datos, curso.actualizadoEn);
    await guardarPortada(curso.id, portada);
    setAccion(null);
    consulta.recargar();
    mostrarToast('Curso actualizado');
  }

  const resultado = consulta.datos;
  const botonNuevo = gestionar && (
    <Button icono={Plus} onClick={() => setAccion({ tipo: 'nuevo' })}>
      Nuevo curso
    </Button>
  );

  return (
    <>
      <header className={pagina.encabezado}>
        <h1 className="titulo-pagina">Cursos</h1>
        {botonNuevo}
      </header>

      <div className={pagina.herramientas}>
        <CampoBusqueda etiqueta="Buscar cursos" placeholder="Buscar por título" valor={filtros.search} alBuscar={buscar} />
        <ChipsFiltro etiqueta="Estado" opciones={OPCIONES_ESTADO} valor={filtros.estado} alCambiar={(estado) => cambiarFiltros({ estado })} />
      </div>

      {consulta.estado === 'error' && (
        <div className={pagina.errorCarga}>
          <Alerta>{consulta.error.message}</Alerta>
          <Button variante="secundario" icono={RotateCw} onClick={consulta.recargar}>
            Reintentar
          </Button>
        </div>
      )}

      {!resultado && consulta.estado === 'cargando' && (
        <div className={styles.cuadricula}>
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} alto={300} />
          ))}
        </div>
      )}

      {resultado && resultado.meta.total === 0 && !hayFiltros && (
        <EstadoVacio icono={BookOpen} titulo="Aún no hay cursos" accion={botonNuevo}>
          <p>
            {gestionar
              ? 'Crea el primer curso con su portada y calificación mínima. Nace en borrador: después le agregas temas y materiales, y su duración se calcula con los videos.'
              : 'Aquí verás los cursos que puedes consultar.'}
          </p>
        </EstadoVacio>
      )}

      {resultado && resultado.meta.total === 0 && hayFiltros && (
        <EstadoVacio
          icono={SearchX}
          titulo="Ningún curso coincide con la búsqueda"
          accion={
            <Button variante="secundario" onClick={() => setParams({}, { replace: true })}>
              Limpiar filtros
            </Button>
          }
        >
          <p>Revisa el texto o cambia el estado.</p>
        </EstadoVacio>
      )}

      {resultado && resultado.meta.total > 0 && (
        <div aria-busy={consulta.estado === 'cargando'}>
          <ul className={styles.cuadricula} aria-label="Cursos">
            {resultado.data.map((curso) => (
              <li key={curso.id}>
                <TarjetaCurso curso={curso} alEditar={() => setAccion({ tipo: 'editar', curso })} />
              </li>
            ))}
          </ul>
          <Paginacion
            meta={resultado.meta}
            nombre="cursos"
            alCambiarPagina={(page) => cambiarFiltros({ page })}
            alCambiarLimite={(limit) => cambiarFiltros({ limit })}
          />
        </div>
      )}

      <PanelLateral
        abierto={accion?.tipo === 'nuevo'}
        titulo="Nuevo curso"
        descripcion="Nace en borrador. Los temas, los materiales y a quién va dirigido se agregan después."
        alCerrar={() => setAccion(null)}
      >
        {accion?.tipo === 'nuevo' && <FormularioCurso alGuardar={crear} alCancelar={() => setAccion(null)} />}
      </PanelLateral>

      <PanelLateral abierto={accion?.tipo === 'editar'} titulo="Editar curso" alCerrar={() => setAccion(null)}>
        {accion?.tipo === 'editar' && (
          <FormularioCurso
            key={accion.curso.id}
            curso={accion.curso}
            alGuardar={(cambios) => editar(accion.curso, cambios)}
            alCancelar={() => setAccion(null)}
          />
        )}
      </PanelLateral>
    </>
  );
}
