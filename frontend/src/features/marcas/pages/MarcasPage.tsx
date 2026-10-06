import { CircleCheck, CircleMinus, Pencil, Plus, Power, PowerOff, RotateCw, SearchX, Tag } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { CampoBusqueda } from '../../../components/ui/CampoBusqueda';
import { Chip } from '../../../components/ui/Chip';
import { ChipsFiltro } from '../../../components/ui/ChipsFiltro';
import { Dialogo } from '../../../components/ui/Dialogo';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import { MenuAcciones, type Accion } from '../../../components/ui/MenuAcciones';
import { PanelLateral } from '../../../components/ui/PanelLateral';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Tabla } from '../../../components/ui/Tabla';
import { clasesTabla } from '../../../components/ui/tabla.clases';
import { mostrarToast } from '../../../components/ui/toast.store';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import styles from '../../../components/ui/Pagina.module.css';
import { FormularioMarca } from '../components/FormularioMarca';
import { marcasService } from '../services/marcas.service';
import type { DatosMarca, Marca } from '../types/marcas.types';

type Estado = 'todas' | 'true' | 'false';

const OPCIONES_ESTADO: { valor: Estado; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'true', etiqueta: 'Activas' },
  { valor: 'false', etiqueta: 'Inactivas' },
];

type Panel = { tipo: 'nueva' } | { tipo: 'editar'; marca: Marca } | null;

// Catalogo de marcas (RF-00.7): superusuario o administrador con "Gestionar marcas"
export function MarcasPage() {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<Estado>('todas');
  const [panel, setPanel] = useState<Panel>(null);
  const [desactivando, setDesactivando] = useState<Marca | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);

  const cargar = useCallback(
    () => marcasService.listar({ search: search || undefined, activo: estado === 'todas' ? undefined : estado === 'true' }),
    [search, estado],
  );
  const consulta = useConsulta(cargar);
  const hayFiltros = search !== '' || estado !== 'todas';
  const cerrarPanel = () => setPanel(null);

  async function crear(datos: DatosMarca) {
    await marcasService.crear(datos);
    cerrarPanel();
    consulta.recargar();
    mostrarToast('Marca creada');
  }

  async function editar(marca: Marca, datos: DatosMarca) {
    await marcasService.actualizar(marca.id, datos);
    cerrarPanel();
    consulta.recargar();
    mostrarToast('Marca actualizada');
  }

  async function cambiarEstado(marca: Marca, activo: boolean) {
    setProcesando(true);
    setErrorConfirmacion(null);
    try {
      await marcasService.cambiarEstado(marca.id, activo);
      setDesactivando(null);
      consulta.recargar();
      mostrarToast(activo ? 'Marca activada' : 'Marca desactivada');
    } catch (error) {
      if (activo) mostrarToast((error as ApiError).message, 'critico');
      else setErrorConfirmacion((error as ApiError).message);
    } finally {
      setProcesando(false);
    }
  }

  function accionesDe(marca: Marca): Accion[] {
    return [
      { etiqueta: 'Editar', icono: Pencil, alElegir: () => setPanel({ tipo: 'editar', marca }) },
      marca.activo
        ? {
            etiqueta: 'Desactivar',
            icono: PowerOff,
            peligro: true,
            alElegir: () => {
              setErrorConfirmacion(null);
              setDesactivando(marca);
            },
          }
        : { etiqueta: 'Activar', icono: Power, alElegir: () => cambiarEstado(marca, true) },
    ];
  }

  const lista = consulta.datos;

  return (
    <>
      <header className={styles.encabezado}>
        <h1 className="titulo-pagina">Marcas</h1>
        <Button icono={Plus} onClick={() => setPanel({ tipo: 'nueva' })}>
          Nueva marca
        </Button>
      </header>

      <div className={styles.herramientas}>
        <CampoBusqueda etiqueta="Buscar marcas" placeholder="Buscar por nombre" valor={search} alBuscar={setSearch} />
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

      {!lista && consulta.estado === 'cargando' && <Skeleton alto={160} />}

      {lista && lista.length === 0 && !hayFiltros && (
        <EstadoVacio
          icono={Tag}
          titulo="Aún no hay marcas"
          accion={
            <Button icono={Plus} onClick={() => setPanel({ tipo: 'nueva' })}>
              Nueva marca
            </Button>
          }
        >
          <p>Cada sucursal vende una marca, y los cursos de una marca llegan a sus sucursales de todas las empresas.</p>
        </EstadoVacio>
      )}

      {lista && lista.length === 0 && hayFiltros && (
        <EstadoVacio
          icono={SearchX}
          titulo="Ninguna marca coincide con la búsqueda"
          accion={
            <Button
              variante="secundario"
              onClick={() => {
                setSearch('');
                setEstado('todas');
              }}
            >
              Limpiar filtros
            </Button>
          }
        >
          <p>Revisa el texto o cambia el filtro de estado.</p>
        </EstadoVacio>
      )}

      {lista && lista.length > 0 && (
        <div aria-busy={consulta.estado === 'cargando'}>
          <Tabla titulo="Marcas de la plataforma">
            <thead>
              <tr>
                <th scope="col">Marca</th>
                <th scope="col" className={clasesTabla.numero}>
                  Sucursales
                </th>
                <th scope="col" className={clasesTabla.numero}>
                  Empresas
                </th>
                <th scope="col">Estado</th>
                <th scope="col" className={clasesTabla.acciones}>
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((marca) => (
                <tr key={marca.id}>
                  <td>
                    <strong>{marca.nombre}</strong>
                    {marca.instruccionesAsistente && <span className={clasesTabla.secundario}>Con instrucciones del asistente</span>}
                  </td>
                  <td data-etiqueta="Sucursales" className={clasesTabla.numero}>
                    {marca.sucursales}
                  </td>
                  <td data-etiqueta="Empresas" className={clasesTabla.numero}>
                    {marca.empresas}
                  </td>
                  <td data-etiqueta="Estado">
                    {marca.activo ? (
                      <Chip tono="exito" icono={CircleCheck}>
                        Activa
                      </Chip>
                    ) : (
                      <Chip icono={CircleMinus}>Inactiva</Chip>
                    )}
                  </td>
                  <td className={`${clasesTabla.acciones} ${clasesTabla.soloMenu}`}>
                    <MenuAcciones etiqueta={`Acciones de ${marca.nombre}`} acciones={accionesDe(marca)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      )}

      <PanelLateral abierto={panel?.tipo === 'nueva'} titulo="Nueva marca" alCerrar={cerrarPanel}>
        <FormularioMarca alGuardar={crear} alCancelar={cerrarPanel} />
      </PanelLateral>

      <PanelLateral abierto={panel?.tipo === 'editar'} titulo="Editar marca" alCerrar={cerrarPanel}>
        {panel?.tipo === 'editar' && (
          <FormularioMarca key={panel.marca.id} marca={panel.marca} alGuardar={(datos) => editar(panel.marca, datos)} alCancelar={cerrarPanel} />
        )}
      </PanelLateral>

      <Dialogo
        abierto={desactivando !== null}
        titulo={desactivando ? `¿Desactivar ${desactivando.nombre}?` : ''}
        textoConfirmar="Desactivar marca"
        textoCargando="Desactivando…"
        peligro
        cargando={procesando}
        error={errorConfirmacion}
        alConfirmar={() => desactivando && cambiarEstado(desactivando, false)}
        alCancelar={() => setDesactivando(null)}
      >
        <p>Dejará de ofrecerse para sucursales nuevas. Sus {desactivando?.sucursales ?? 0} sucursales actuales y sus empleados no cambian.</p>
      </Dialogo>
    </>
  );
}
