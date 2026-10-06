import { Building2, CircleCheck, CircleMinus, Plus, RotateCw, SearchX } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { CampoBusqueda } from '../../../components/ui/CampoBusqueda';
import { Chip } from '../../../components/ui/Chip';
import { ChipsFiltro } from '../../../components/ui/ChipsFiltro';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import { Paginacion } from '../../../components/ui/Paginacion';
import { PanelLateral } from '../../../components/ui/PanelLateral';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Tabla } from '../../../components/ui/Tabla';
import { clasesTabla } from '../../../components/ui/tabla.clases';
import { mostrarToast } from '../../../components/ui/toast.store';
import { useConsulta } from '../../../hooks/useConsulta';
import { FormularioEmpresa } from '../components/FormularioEmpresa';
import { empresasService } from '../services/empresas.service';
import type { DatosEmpresa, FiltrosEmpresas } from '../types/empresas.types';
import styles from '../../../components/ui/Pagina.module.css';

const OPCIONES_ESTADO: { valor: FiltrosEmpresas['activo']; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'true', etiqueta: 'Activas' },
  { valor: 'false', etiqueta: 'Inactivas' },
];

// Los filtros viven en la URL: al volver del detalle se conserva la busqueda y la pagina
function leerFiltros(params: URLSearchParams): FiltrosEmpresas {
  const activo = params.get('activo');
  return {
    page: Number(params.get('page')) || 1,
    limit: Number(params.get('limit')) || 20,
    search: params.get('search') ?? '',
    activo: activo === 'true' || activo === 'false' ? activo : 'todas',
  };
}

export function EmpresasPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [creando, setCreando] = useState(false);
  const filtros = useMemo(() => leerFiltros(params), [params]);
  const hayFiltros = filtros.search !== '' || filtros.activo !== 'todas';

  const cargar = useCallback(() => empresasService.listar(filtros), [filtros]);
  const consulta = useConsulta(cargar);

  const cambiarFiltros = useCallback(
    (cambios: Partial<FiltrosEmpresas>) => {
      const siguientes = { ...filtros, page: 1, ...cambios };
      const nuevos = new URLSearchParams();
      if (siguientes.page > 1) nuevos.set('page', String(siguientes.page));
      if (siguientes.limit !== 20) nuevos.set('limit', String(siguientes.limit));
      if (siguientes.search) nuevos.set('search', siguientes.search);
      if (siguientes.activo !== 'todas') nuevos.set('activo', siguientes.activo);
      setParams(nuevos, { replace: true });
    },
    [filtros, setParams],
  );
  const buscar = useCallback((search: string) => cambiarFiltros({ search }), [cambiarFiltros]);

  async function crear(datos: DatosEmpresa) {
    const empresa = await empresasService.crear(datos);
    setCreando(false);
    mostrarToast('Empresa creada');
    // Una empresa sin sucursales no puede operar (HU-00): se pide la primera de inmediato
    navigate(`/empresas/${empresa.id}`, { state: { nuevaSucursal: true } });
  }

  const pagina = consulta.datos;

  return (
    <>
      <header className={styles.encabezado}>
        <h1 className="titulo-pagina">Empresas</h1>
        <Button icono={Plus} onClick={() => setCreando(true)}>
          Nueva empresa
        </Button>
      </header>

      <div className={styles.herramientas}>
        <CampoBusqueda etiqueta="Buscar empresas" placeholder="Buscar por nombre, razón social o prefijo" valor={filtros.search} alBuscar={buscar} />
        <ChipsFiltro etiqueta="Estado" opciones={OPCIONES_ESTADO} valor={filtros.activo} alCambiar={(activo) => cambiarFiltros({ activo })} />
      </div>

      {consulta.estado === 'error' && (
        <div className={styles.errorCarga}>
          <Alerta>{consulta.error.message}</Alerta>
          <Button variante="secundario" icono={RotateCw} onClick={consulta.recargar}>
            Reintentar
          </Button>
        </div>
      )}

      {!pagina && consulta.estado === 'cargando' && <TablaCargando />}

      {pagina && pagina.meta.total === 0 && !hayFiltros && (
        <EstadoVacio
          icono={Building2}
          titulo="Aún no hay empresas"
          accion={
            <Button icono={Plus} onClick={() => setCreando(true)}>
              Nueva empresa
            </Button>
          }
        >
          <p>Cada empresa tiene sus sucursales, y cada sucursal vende una marca y tiene sus propios empleados.</p>
        </EstadoVacio>
      )}

      {pagina && pagina.meta.total === 0 && hayFiltros && (
        <EstadoVacio
          icono={SearchX}
          titulo="Ninguna empresa coincide con la búsqueda"
          accion={
            <Button variante="secundario" onClick={() => setParams({}, { replace: true })}>
              Limpiar filtros
            </Button>
          }
        >
          <p>Revisa el texto o cambia el filtro de estado.</p>
        </EstadoVacio>
      )}

      {pagina && pagina.meta.total > 0 && (
        <div aria-busy={consulta.estado === 'cargando'}>
          <Tabla titulo="Empresas de la plataforma">
            <thead>
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">Prefijo</th>
                <th scope="col">Estado</th>
                <th scope="col" className={clasesTabla.numero}>
                  Sucursales activas
                </th>
                <th scope="col" className={clasesTabla.numero}>
                  Administradores
                </th>
                <th scope="col" className={clasesTabla.numero}>
                  Empleados activos
                </th>
                <th scope="col" className={clasesTabla.acciones}>
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagina.data.map((empresa) => (
                <tr key={empresa.id} className={clasesTabla.filaEnlace}>
                  <td>
                    <Link to={`/empresas/${empresa.id}`} className={clasesTabla.enlaceFila}>
                      {empresa.nombre}
                    </Link>
                    {empresa.razonSocial && <span className={clasesTabla.secundario}>{empresa.razonSocial}</span>}
                  </td>
                  <td data-etiqueta="Prefijo" className="cifras-tabulares">
                    {empresa.prefijoFolio}
                  </td>
                  <td data-etiqueta="Estado">
                    {empresa.activo ? (
                      <Chip tono="exito" icono={CircleCheck}>
                        Activa
                      </Chip>
                    ) : (
                      <Chip icono={CircleMinus}>Inactiva</Chip>
                    )}
                  </td>
                  <td data-etiqueta="Sucursales activas" className={clasesTabla.numero}>
                    {empresa.sucursalesActivas}
                  </td>
                  <td data-etiqueta="Administradores" className={clasesTabla.numero}>
                    {empresa.administradores}
                  </td>
                  <td data-etiqueta="Empleados activos" className={clasesTabla.numero}>
                    {empresa.empleadosActivos.toLocaleString('es-MX')}
                  </td>
                  <td className={clasesTabla.acciones}>
                    <span className={styles.accionTexto} aria-hidden="true">
                      Ver empresa
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <Paginacion
            meta={pagina.meta}
            nombre="empresas"
            alCambiarPagina={(page) => cambiarFiltros({ page })}
            alCambiarLimite={(limit) => cambiarFiltros({ limit })}
          />
        </div>
      )}

      <PanelLateral
        abierto={creando}
        titulo="Nueva empresa"
        descripcion="Después de crearla, registrarás sus sucursales."
        alCerrar={() => setCreando(false)}
      >
        <FormularioEmpresa alGuardar={crear} alCancelar={() => setCreando(false)} />
      </PanelLateral>
    </>
  );
}

function TablaCargando() {
  return (
    <div className={styles.cargando} aria-busy="true" aria-label="Cargando empresas">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={styles.filaCargando}>
          <Skeleton ancho="32%" alto={14} />
          <Skeleton ancho={72} alto={24} />
          <Skeleton ancho={32} alto={14} />
          <Skeleton ancho={32} alto={14} />
        </div>
      ))}
    </div>
  );
}
