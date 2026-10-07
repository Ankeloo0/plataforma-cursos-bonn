import { BriefcaseBusiness, CircleCheck, CircleMinus, Layers, ListTree, Pencil, Plus, Power, PowerOff, RotateCw, SearchX } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { CampoBusqueda } from '../../../components/ui/CampoBusqueda';
import { Chip } from '../../../components/ui/Chip';
import { ChipsFiltro } from '../../../components/ui/ChipsFiltro';
import { Dialogo } from '../../../components/ui/Dialogo';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import { MenuAcciones, type Accion } from '../../../components/ui/MenuAcciones';
import styles from '../../../components/ui/Pagina.module.css';
import { PanelLateral } from '../../../components/ui/PanelLateral';
import { Pestanas } from '../../../components/ui/Pestanas';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Tabla } from '../../../components/ui/Tabla';
import { clasesTabla } from '../../../components/ui/tabla.clases';
import { mostrarToast } from '../../../components/ui/toast.store';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import { FormularioArea } from '../components/FormularioArea';
import { FormularioPuesto } from '../components/FormularioPuesto';
import { catalogoService } from '../services/catalogo.service';
import type { Area, DatosArea, DatosPuesto, Puesto } from '../types/catalogo.types';
import { textoUso } from '../utils/uso';
import propios from './CatalogoPage.module.css';

type Vista = 'areas' | 'puestos';
type Estado = 'todos' | 'true' | 'false';

const OPCIONES_ESTADO: { valor: Estado; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'true', etiqueta: 'Activos' },
  { valor: 'false', etiqueta: 'Inactivos' },
];

type Panel =
  | { tipo: 'nuevaArea' }
  | { tipo: 'editarArea'; area: Area }
  | { tipo: 'nuevoPuesto' }
  | { tipo: 'editarPuesto'; puesto: Puesto }
  | null;

type Desactivando = { tipo: 'area'; area: Area } | { tipo: 'puesto'; puesto: Puesto } | null;

const activoDe = (estado: Estado) => (estado === 'todos' ? undefined : estado === 'true');

// Catalogo unico de areas y puestos (RF-02.1 a RF-02.3, D-25): superusuario o "Gestionar areas y puestos"
export function CatalogoPage() {
  const [vista, setVista] = useState<Vista>('areas');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<Estado>('todos');
  const [areaFiltro, setAreaFiltro] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [desactivando, setDesactivando] = useState<Desactivando>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);

  // La lista completa de areas tambien alimenta el filtro y el formulario de puestos
  const todasLasAreas = useConsulta(useCallback(() => catalogoService.listarAreas(), []));
  const areas = useConsulta(
    useCallback(() => catalogoService.listarAreas({ search: search || undefined, activo: activoDe(estado) }), [search, estado]),
  );
  const puestos = useConsulta(
    useCallback(
      () => catalogoService.listarPuestos({ search: search || undefined, activo: activoDe(estado), areaId: areaFiltro || undefined }),
      [search, estado, areaFiltro],
    ),
  );

  const consulta = vista === 'areas' ? areas : puestos;
  const hayFiltros = search !== '' || estado !== 'todos' || (vista === 'puestos' && areaFiltro !== '');
  const areaElegida = todasLasAreas.datos?.find((a) => a.id === areaFiltro);
  const cerrarPanel = () => setPanel(null);

  function recargarTodo() {
    todasLasAreas.recargar();
    areas.recargar();
    puestos.recargar();
  }

  function cambiarVista(siguiente: Vista) {
    setVista(siguiente);
    setSearch('');
    setEstado('todos');
  }

  function limpiarFiltros() {
    setSearch('');
    setEstado('todos');
    setAreaFiltro('');
  }

  async function guardar(accion: () => Promise<unknown>, mensaje: string) {
    await accion();
    cerrarPanel();
    recargarTodo();
    mostrarToast(mensaje);
  }

  async function cambiarEstado(accion: () => Promise<unknown>, activo: boolean, mensaje: string) {
    setProcesando(true);
    setErrorConfirmacion(null);
    try {
      await accion();
      setDesactivando(null);
      recargarTodo();
      mostrarToast(mensaje);
    } catch (error) {
      if (activo) mostrarToast((error as ApiError).message, 'critico');
      else setErrorConfirmacion((error as ApiError).message);
    } finally {
      setProcesando(false);
    }
  }

  function accionesDeArea(area: Area): Accion[] {
    return [
      {
        etiqueta: 'Ver sus puestos',
        icono: ListTree,
        alElegir: () => {
          cambiarVista('puestos');
          setAreaFiltro(area.id);
        },
      },
      { etiqueta: 'Editar', icono: Pencil, alElegir: () => setPanel({ tipo: 'editarArea', area }) },
      area.activo
        ? {
            etiqueta: 'Desactivar',
            icono: PowerOff,
            peligro: true,
            alElegir: () => {
              setErrorConfirmacion(null);
              setDesactivando({ tipo: 'area', area });
            },
          }
        : {
            etiqueta: 'Activar',
            icono: Power,
            alElegir: () => cambiarEstado(() => catalogoService.cambiarEstadoArea(area.id, true), true, 'Área activada'),
          },
    ];
  }

  function accionesDePuesto(puesto: Puesto): Accion[] {
    return [
      { etiqueta: 'Editar', icono: Pencil, alElegir: () => setPanel({ tipo: 'editarPuesto', puesto }) },
      puesto.activo
        ? {
            etiqueta: 'Desactivar',
            icono: PowerOff,
            peligro: true,
            alElegir: () => {
              setErrorConfirmacion(null);
              setDesactivando({ tipo: 'puesto', puesto });
            },
          }
        : {
            etiqueta: 'Activar',
            icono: Power,
            alElegir: () => cambiarEstado(() => catalogoService.cambiarEstadoPuesto(puesto.id, true), true, 'Puesto activado'),
          },
    ];
  }

  const nuevo = vista === 'areas' ? () => setPanel({ tipo: 'nuevaArea' }) : () => setPanel({ tipo: 'nuevoPuesto' });
  const textoNuevo = vista === 'areas' ? 'Nueva área' : 'Nuevo puesto';
  const sinAreasActivas = todasLasAreas.datos !== null && !todasLasAreas.datos.some((a) => a.activo);

  return (
    <>
      <header className={styles.encabezado}>
        <h1 className="titulo-pagina">Áreas y puestos</h1>
        <Button
          icono={Plus}
          onClick={nuevo}
          disabled={vista === 'puestos' && sinAreasActivas}
          motivoDeshabilitado="Primero crea o activa un área"
        >
          {textoNuevo}
        </Button>
      </header>

      <p className={propios.explicacion}>
        Un solo catálogo para todas las empresas y marcas. El puesto es el tipo de empleado: define qué cursos recibe.
      </p>

      <Pestanas
        etiqueta="Catálogo"
        opciones={[
          { valor: 'areas', etiqueta: 'Áreas' },
          { valor: 'puestos', etiqueta: 'Puestos' },
        ]}
        valor={vista}
        alCambiar={cambiarVista}
        idPanel="panel-catalogo"
        className={propios.pestanas}
      />

      <div role="tabpanel" id="panel-catalogo" aria-labelledby={`panel-catalogo-${vista}`}>
        <div className={styles.herramientas}>
          <CampoBusqueda
            key={vista}
            etiqueta={vista === 'areas' ? 'Buscar áreas' : 'Buscar puestos'}
            placeholder="Buscar por nombre"
            valor={search}
            alBuscar={setSearch}
          />
          {vista === 'puestos' && (
            <Select
              etiqueta="Área"
              className={styles.filtroLista}
              textoVacio="Todas las áreas"
              opciones={(todasLasAreas.datos ?? []).map((a) => ({ valor: a.id, etiqueta: a.activo ? a.nombre : `${a.nombre} (inactiva)` }))}
              value={areaFiltro}
              onChange={(e) => setAreaFiltro(e.target.value)}
            />
          )}
          <ChipsFiltro etiqueta="Estado" opciones={OPCIONES_ESTADO} valor={estado} alCambiar={setEstado} />
        </div>

        {consulta.estado === 'error' && (
          <div className={styles.errorCarga}>
            <Alerta>{consulta.error.message}</Alerta>
            <Button variante="secundario" icono={RotateCw} onClick={consulta.recargar}>
              Reintentar
            </Button>
          </div>
        )}

        {!consulta.datos && consulta.estado === 'cargando' && <Skeleton alto={160} />}

        {consulta.datos && consulta.datos.length === 0 && !hayFiltros && vista === 'areas' && (
          <EstadoVacio
            icono={Layers}
            titulo="Aún no hay áreas"
            accion={
              <Button icono={Plus} onClick={nuevo}>
                Nueva área
              </Button>
            }
          >
            <p>Las áreas agrupan los puestos, por ejemplo Servicio, Ventas o Refacciones.</p>
          </EstadoVacio>
        )}

        {consulta.datos && consulta.datos.length === 0 && vista === 'puestos' && (!hayFiltros || (areaElegida && !search && estado === 'todos')) && (
          <EstadoVacio
            icono={BriefcaseBusiness}
            titulo={areaElegida ? `Aún no hay puestos en ${areaElegida.nombre}` : 'Aún no hay puestos'}
            accion={
              !sinAreasActivas && (
                <Button icono={Plus} onClick={nuevo}>
                  Crear puesto
                </Button>
              )
            }
          >
            <p>
              {sinAreasActivas
                ? 'Primero crea un área en la pestaña Áreas.'
                : 'Los puestos definen qué cursos recibe cada empleado, por ejemplo Asesor de servicio.'}
            </p>
          </EstadoVacio>
        )}

        {consulta.datos && consulta.datos.length === 0 && hayFiltros && !(vista === 'puestos' && areaElegida && !search && estado === 'todos') && (
          <EstadoVacio
            icono={SearchX}
            titulo="Nada coincide con la búsqueda"
            accion={
              <Button variante="secundario" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            }
          >
            <p>Revisa el texto o cambia los filtros.</p>
          </EstadoVacio>
        )}

        {vista === 'areas' && areas.datos && areas.datos.length > 0 && (
          <div aria-busy={areas.estado === 'cargando'}>
            <Tabla titulo="Áreas del catálogo">
              <thead>
                <tr>
                  <th scope="col">Área</th>
                  <th scope="col" className={clasesTabla.numero}>
                    Puestos activos
                  </th>
                  <th scope="col">En uso</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className={clasesTabla.acciones}>
                    <span className="solo-lector">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {areas.datos.map((area) => (
                  <tr key={area.id}>
                    <td>
                      <strong>{area.nombre}</strong>
                      {area.descripcion && <span className={clasesTabla.secundario}>{area.descripcion}</span>}
                    </td>
                    <td data-etiqueta="Puestos activos" className={clasesTabla.numero}>
                      {area.puestosActivos}
                      {area.puestos > area.puestosActivos && <span className={clasesTabla.secundario}>de {area.puestos}</span>}
                    </td>
                    <td data-etiqueta="En uso">{area.uso.empleados === 0 ? <span className={styles.sinDato}>{textoUso(area.uso)}</span> : textoUso(area.uso)}</td>
                    <td data-etiqueta="Estado">
                      <EstadoCatalogo activo={area.activo} femenino />
                    </td>
                    <td className={`${clasesTabla.acciones} ${clasesTabla.soloMenu}`}>
                      <MenuAcciones etiqueta={`Acciones de ${area.nombre}`} acciones={accionesDeArea(area)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </div>
        )}

        {vista === 'puestos' && puestos.datos && puestos.datos.length > 0 && (
          <div aria-busy={puestos.estado === 'cargando'}>
            <Tabla titulo="Puestos del catálogo">
              <thead>
                <tr>
                  <th scope="col">Puesto</th>
                  <th scope="col">Área</th>
                  <th scope="col">En uso</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className={clasesTabla.acciones}>
                    <span className="solo-lector">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {puestos.datos.map((puesto) => (
                  <tr key={puesto.id}>
                    <td>
                      <strong>{puesto.nombre}</strong>
                      {puesto.descripcion && <span className={clasesTabla.secundario}>{puesto.descripcion}</span>}
                    </td>
                    <td data-etiqueta="Área">{puesto.area.nombre}</td>
                    <td data-etiqueta="En uso">
                      {puesto.uso.empleados === 0 ? <span className={styles.sinDato}>{textoUso(puesto.uso)}</span> : textoUso(puesto.uso)}
                    </td>
                    <td data-etiqueta="Estado">
                      <EstadoCatalogo activo={puesto.activo} />
                    </td>
                    <td className={`${clasesTabla.acciones} ${clasesTabla.soloMenu}`}>
                      <MenuAcciones etiqueta={`Acciones de ${puesto.nombre}`} acciones={accionesDePuesto(puesto)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </div>
        )}
      </div>

      <PanelLateral abierto={panel?.tipo === 'nuevaArea'} titulo="Nueva área" alCerrar={cerrarPanel}>
        <FormularioArea alGuardar={(datos: DatosArea) => guardar(() => catalogoService.crearArea(datos), 'Área creada')} alCancelar={cerrarPanel} />
      </PanelLateral>

      <PanelLateral abierto={panel?.tipo === 'editarArea'} titulo="Editar área" alCerrar={cerrarPanel}>
        {panel?.tipo === 'editarArea' && (
          <FormularioArea
            key={panel.area.id}
            area={panel.area}
            alGuardar={(datos) => guardar(() => catalogoService.actualizarArea(panel.area.id, datos), 'Área actualizada')}
            alCancelar={cerrarPanel}
          />
        )}
      </PanelLateral>

      <PanelLateral abierto={panel?.tipo === 'nuevoPuesto'} titulo="Nuevo puesto" alCerrar={cerrarPanel}>
        {panel?.tipo === 'nuevoPuesto' && (
          <FormularioPuesto
            areas={todasLasAreas.datos ?? []}
            areaInicial={areaElegida?.activo ? areaElegida.id : undefined}
            alGuardar={(datos: DatosPuesto) => guardar(() => catalogoService.crearPuesto(datos), 'Puesto creado')}
            alCancelar={cerrarPanel}
          />
        )}
      </PanelLateral>

      <PanelLateral abierto={panel?.tipo === 'editarPuesto'} titulo="Editar puesto" alCerrar={cerrarPanel}>
        {panel?.tipo === 'editarPuesto' && (
          <FormularioPuesto
            key={panel.puesto.id}
            puesto={panel.puesto}
            areas={todasLasAreas.datos ?? []}
            alGuardar={(datos) => guardar(() => catalogoService.actualizarPuesto(panel.puesto.id, datos), 'Puesto actualizado')}
            alCancelar={cerrarPanel}
          />
        )}
      </PanelLateral>

      <Dialogo
        abierto={desactivando !== null}
        titulo={desactivando ? `¿Desactivar ${desactivando.tipo === 'area' ? desactivando.area.nombre : desactivando.puesto.nombre}?` : ''}
        textoConfirmar={desactivando?.tipo === 'area' ? 'Desactivar área' : 'Desactivar puesto'}
        textoCargando="Desactivando…"
        peligro
        cargando={procesando}
        error={errorConfirmacion}
        alConfirmar={() => {
          if (desactivando?.tipo === 'area') {
            cambiarEstado(() => catalogoService.cambiarEstadoArea(desactivando.area.id, false), false, 'Área desactivada');
          } else if (desactivando?.tipo === 'puesto') {
            cambiarEstado(() => catalogoService.cambiarEstadoPuesto(desactivando.puesto.id, false), false, 'Puesto desactivado');
          }
        }}
        alCancelar={() => setDesactivando(null)}
      >
        {desactivando?.tipo === 'area' && (
          <p>
            Dejará de ofrecerse en todas las empresas.
            {desactivando.area.puestosActivos > 0 &&
              ` Tiene ${desactivando.area.puestosActivos} ${desactivando.area.puestosActivos === 1 ? 'puesto activo' : 'puestos activos'}: desactívalos primero.`}
          </p>
        )}
        {desactivando?.tipo === 'puesto' && (
          <p>
            No se podrá asignar a empleados nuevos en ninguna empresa.
            {desactivando.puesto.uso.empleados > 0 && ` Hoy lo usan ${textoUso(desactivando.puesto.uso).toLowerCase()}: cámbialos de puesto primero.`}
          </p>
        )}
      </Dialogo>
    </>
  );
}

function EstadoCatalogo({ activo, femenino = false }: { activo: boolean; femenino?: boolean }) {
  return activo ? (
    <Chip tono="exito" icono={CircleCheck}>
      {femenino ? 'Activa' : 'Activo'}
    </Chip>
  ) : (
    <Chip icono={CircleMinus}>{femenino ? 'Inactiva' : 'Inactivo'}</Chip>
  );
}
