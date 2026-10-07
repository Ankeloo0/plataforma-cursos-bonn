import { RotateCw, SearchX, UserPlus, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { CampoBusqueda } from '../../../components/ui/CampoBusqueda';
import { ChipsFiltro } from '../../../components/ui/ChipsFiltro';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import { MenuAcciones } from '../../../components/ui/MenuAcciones';
import styles from '../../../components/ui/Pagina.module.css';
import { Paginacion } from '../../../components/ui/Paginacion';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Tabla } from '../../../components/ui/Tabla';
import { clasesTabla } from '../../../components/ui/tabla.clases';
import { useConsulta } from '../../../hooks/useConsulta';
import { puede } from '../../../utils/permisos';
import { EstadoCuenta } from '../../administradores/components/EstadoCuenta';
import { useAuthStore } from '../../auth/stores/auth.store';
import { catalogoService } from '../../catalogo/services/catalogo.service';
import { sucursalesService } from '../../empresas/services/sucursales.service';
import { GestionEmpleado } from '../components/GestionEmpleado';
import { accionesDeEmpleado, nombreEmpleado, type AccionEmpleado } from '../utils/empleado';
import { empleadosService } from '../services/empleados.service';
import type { FiltrosEmpleados } from '../types/empleados.types';

const OPCIONES_ESTADO: { valor: FiltrosEmpleados['activo']; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'true', etiqueta: 'Activos' },
  { valor: 'false', etiqueta: 'De baja' },
];

function leerFiltros(params: URLSearchParams): FiltrosEmpleados {
  const activo = params.get('activo');
  return {
    page: Number(params.get('page')) || 1,
    limit: Number(params.get('limit')) || 20,
    search: params.get('search') ?? '',
    sucursalId: params.get('sucursalId') ?? '',
    areaId: params.get('areaId') ?? '',
    puestoId: params.get('puestoId') ?? '',
    activo: activo === 'true' || activo === 'false' ? activo : 'todos',
  };
}

// Empleados de las sucursales del alcance (RF-03.1 a RF-03.5). Los filtros viven en la URL.
export function EmpleadosPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => leerFiltros(params), [params]);
  const hayFiltros = filtros.search !== '' || filtros.sucursalId !== '' || filtros.areaId !== '' || filtros.puestoId !== '' || filtros.activo !== 'todos';
  const [accion, setAccion] = useState<AccionEmpleado>(null);

  const consulta = useConsulta(useCallback(() => empleadosService.listar(filtros), [filtros]));
  const sucursales = useConsulta(useCallback(() => sucursalesService.listarEnAlcance(), []));
  const areas = useConsulta(useCallback(() => catalogoService.listarAreas(), []));
  const puestos = useConsulta(useCallback(() => catalogoService.listarPuestos(), []));
  const gestionar = puede(usuario, 'EMPLEADOS_GESTIONAR');

  const cambiarFiltros = useCallback(
    (cambios: Partial<FiltrosEmpleados>) => {
      const siguientes = { ...filtros, page: 1, ...cambios };
      const nuevos = new URLSearchParams();
      if (siguientes.page > 1) nuevos.set('page', String(siguientes.page));
      if (siguientes.limit !== 20) nuevos.set('limit', String(siguientes.limit));
      if (siguientes.search) nuevos.set('search', siguientes.search);
      if (siguientes.sucursalId) nuevos.set('sucursalId', siguientes.sucursalId);
      if (siguientes.areaId) nuevos.set('areaId', siguientes.areaId);
      if (siguientes.puestoId) nuevos.set('puestoId', siguientes.puestoId);
      if (siguientes.activo !== 'todos') nuevos.set('activo', siguientes.activo);
      setParams(nuevos, { replace: true });
    },
    [filtros, setParams],
  );
  const buscar = useCallback((search: string) => cambiarFiltros({ search }), [cambiarFiltros]);

  // Al elegir un area, el filtro de puesto solo ofrece los de esa area
  const puestosDelFiltro = (puestos.datos ?? []).filter((p) => !filtros.areaId || p.area.id === filtros.areaId);
  const pagina = consulta.datos;
  // Sin catalogo no se puede dar de alta: el formulario necesita puestos y sucursales
  const listoParaAlta = sucursales.datos !== null && puestos.datos !== null;

  return (
    <>
      <header className={styles.encabezado}>
        <h1 className="titulo-pagina">Empleados</h1>
        {gestionar && (
          <Button icono={UserPlus} disabled={!listoParaAlta} motivoDeshabilitado="Cargando sucursales y puestos" onClick={() => setAccion({ tipo: 'nuevo' })}>
            Nuevo empleado
          </Button>
        )}
      </header>

      <div className={styles.herramientas}>
        <CampoBusqueda etiqueta="Buscar empleados" placeholder="Buscar por nombre o número" valor={filtros.search} alBuscar={buscar} />
        {sucursales.datos && sucursales.datos.length > 1 && (
          <Select
            etiqueta="Sucursal"
            className={styles.filtroLista}
            textoVacio="Todas mis sucursales"
            opciones={sucursales.datos.map((s) => ({ valor: s.id, etiqueta: `${s.nombre} · ${s.empresa.nombre}` }))}
            value={filtros.sucursalId}
            onChange={(e) => cambiarFiltros({ sucursalId: e.target.value })}
          />
        )}
        <Select
          etiqueta="Área"
          className={styles.filtroLista}
          textoVacio="Todas las áreas"
          opciones={(areas.datos ?? []).map((a) => ({ valor: a.id, etiqueta: a.nombre }))}
          value={filtros.areaId}
          onChange={(e) => cambiarFiltros({ areaId: e.target.value, puestoId: '' })}
        />
        <Select
          etiqueta="Puesto"
          className={styles.filtroLista}
          textoVacio="Todos los puestos"
          opciones={puestosDelFiltro.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
          value={filtros.puestoId}
          onChange={(e) => cambiarFiltros({ puestoId: e.target.value })}
        />
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

      {!pagina && consulta.estado === 'cargando' && <Skeleton alto={160} />}

      {pagina && pagina.meta.total === 0 && !hayFiltros && (
        <EstadoVacio
          icono={Users}
          titulo="Aún no hay empleados"
          accion={
            gestionar &&
            listoParaAlta && (
              <Button icono={UserPlus} onClick={() => setAccion({ tipo: 'nuevo' })}>
                Nuevo empleado
              </Button>
            )
          }
        >
          <p>
            {usuario?.rol === 'ADMIN' && usuario.sucursales.length === 0
              ? 'Todavía no tienes sucursales asignadas. Pídeselas al superusuario.'
              : 'Cada empleado entra con su empresa y su número de empleado, y recibe los cursos de su sucursal y su puesto.'}
          </p>
        </EstadoVacio>
      )}

      {pagina && pagina.meta.total === 0 && hayFiltros && (
        <EstadoVacio
          icono={SearchX}
          titulo="Ningún empleado coincide con la búsqueda"
          accion={
            <Button variante="secundario" onClick={() => setParams({}, { replace: true })}>
              Limpiar filtros
            </Button>
          }
        >
          <p>Revisa el texto o cambia los filtros.</p>
        </EstadoVacio>
      )}

      {pagina && pagina.meta.total > 0 && (
        <div aria-busy={consulta.estado === 'cargando'}>
          <Tabla titulo="Empleados de mis sucursales">
            <thead>
              <tr>
                <th scope="col">Empleado</th>
                <th scope="col">Puesto</th>
                <th scope="col">Sucursal</th>
                <th scope="col">Estado</th>
                <th scope="col" className={clasesTabla.acciones}>
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagina.data.map((empleado) => (
                <tr key={empleado.id}>
                  <td>
                    <div className={clasesTabla.persona}>
                      <Avatar
                        id={empleado.usuarioId}
                        nombres={empleado.nombres}
                        apellidoPaterno={empleado.apellidoPaterno}
                        src={empleado.fotoUrl}
                        tamano={32}
                        decorativo
                      />
                      <div>
                        <Link to={`/empleados/${empleado.id}`}>
                          <strong>{nombreEmpleado(empleado)}</strong>
                        </Link>
                        <span className={`${styles.usuarioSecundario} cifras-tabulares`}>No. {empleado.numeroEmpleado}</span>
                      </div>
                    </div>
                  </td>
                  <td data-etiqueta="Puesto">
                    {empleado.puesto.nombre}
                    <span className={clasesTabla.secundario}>{empleado.area.nombre}</span>
                  </td>
                  <td data-etiqueta="Sucursal">
                    {empleado.sucursal.nombre}
                    <span className={clasesTabla.secundario}>{empleado.empresa.nombre}</span>
                  </td>
                  <td data-etiqueta="Estado">
                    <EstadoCuenta cuenta={empleado} />
                  </td>
                  <td className={`${clasesTabla.acciones} ${clasesTabla.soloMenu}`}>
                    <MenuAcciones
                      etiqueta={`Acciones de ${nombreEmpleado(empleado)}`}
                      acciones={accionesDeEmpleado(empleado, usuario, setAccion, consulta.recargar, {
                        verFicha: () => navigate(`/empleados/${empleado.id}`),
                      })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <Paginacion
            meta={pagina.meta}
            nombre="empleados"
            alCambiarPagina={(page) => cambiarFiltros({ page })}
            alCambiarLimite={(limit) => cambiarFiltros({ limit })}
          />
        </div>
      )}

      <GestionEmpleado
        accion={accion}
        sucursales={sucursales.datos ?? []}
        puestos={puestos.datos ?? []}
        alCerrar={() => setAccion(null)}
        alCambiar={(empleado) => {
          // Despues del alta se abre su ficha; despues de editar se recarga la lista
          if (empleado && accion?.tipo === 'nuevo') navigate(`/empleados/${empleado.id}`);
          else consulta.recargar();
        }}
      />
    </>
  );
}
