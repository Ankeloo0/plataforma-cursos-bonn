import { KeyRound, LockOpen, Pencil, Power, PowerOff, RotateCw, SearchX, ShieldCheck, UserPlus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { CampoBusqueda } from '../../../components/ui/CampoBusqueda';
import { ChipsFiltro } from '../../../components/ui/ChipsFiltro';
import { Dialogo } from '../../../components/ui/Dialogo';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import { MenuAcciones, type Accion } from '../../../components/ui/MenuAcciones';
import styles from '../../../components/ui/Pagina.module.css';
import { Paginacion } from '../../../components/ui/Paginacion';
import { PanelLateral } from '../../../components/ui/PanelLateral';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Tabla } from '../../../components/ui/Tabla';
import { clasesTabla } from '../../../components/ui/tabla.clases';
import { mostrarToast } from '../../../components/ui/toast.store';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import { fechaHora } from '../../../utils/formato';
import { EstadoCuenta } from '../components/EstadoCuenta';
import { FormularioAdministrador, type CambiosAdministrador } from '../components/FormularioAdministrador';
import { FormularioRestablecer } from '../components/FormularioRestablecer';
import { administradoresService } from '../services/administradores.service';
import type { Administrador, AdministradorResumen, FiltrosAdministradores } from '../types/administradores.types';
import { nombreAdministrador } from '../utils/nombre';

const OPCIONES_ESTADO: { valor: FiltrosAdministradores['activo']; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'true', etiqueta: 'Activos' },
  { valor: 'false', etiqueta: 'Inactivos' },
];

type Panel = { tipo: 'nuevo' } | { tipo: 'editar'; admin: AdministradorResumen } | { tipo: 'restablecer'; admin: AdministradorResumen } | null;

function leerFiltros(params: URLSearchParams): FiltrosAdministradores {
  const activo = params.get('activo');
  return {
    page: Number(params.get('page')) || 1,
    limit: Number(params.get('limit')) || 20,
    search: params.get('search') ?? '',
    activo: activo === 'true' || activo === 'false' ? activo : 'todos',
  };
}

function resumenAcceso(admin: AdministradorResumen): string {
  const permisos = `${admin.totalPermisos} ${admin.totalPermisos === 1 ? 'permiso' : 'permisos'}`;
  const sucursales = `${admin.totalSucursales} ${admin.totalSucursales === 1 ? 'sucursal' : 'sucursales'}`;
  return `${permisos} · ${sucursales}`;
}

// Solo el superusuario (RF-00.2, RF-00.3, P-49)
export function AdministradoresPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filtros = useMemo(() => leerFiltros(params), [params]);
  const hayFiltros = filtros.search !== '' || filtros.activo !== 'todos';
  const [panel, setPanel] = useState<Panel>(null);
  const [desactivando, setDesactivando] = useState<AdministradorResumen | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);

  const cargar = useCallback(() => administradoresService.listar(filtros), [filtros]);
  const consulta = useConsulta(cargar);
  const cerrarPanel = () => setPanel(null);

  const cambiarFiltros = useCallback(
    (cambios: Partial<FiltrosAdministradores>) => {
      const siguientes = { ...filtros, page: 1, ...cambios };
      const nuevos = new URLSearchParams();
      if (siguientes.page > 1) nuevos.set('page', String(siguientes.page));
      if (siguientes.limit !== 20) nuevos.set('limit', String(siguientes.limit));
      if (siguientes.search) nuevos.set('search', siguientes.search);
      if (siguientes.activo !== 'todos') nuevos.set('activo', siguientes.activo);
      setParams(nuevos, { replace: true });
    },
    [filtros, setParams],
  );
  const buscar = useCallback((search: string) => cambiarFiltros({ search }), [cambiarFiltros]);

  // La foto se sube despues de guardar los datos: si falla, los datos ya quedaron guardados
  async function guardarFoto(adminId: string, foto: File | null | undefined): Promise<void> {
    if (foto === undefined) return;
    try {
      if (foto) await administradoresService.cambiarFoto(adminId, foto);
      else await administradoresService.quitarFoto(adminId);
    } catch (error) {
      mostrarToast(`Los datos se guardaron, pero la foto no: ${(error as ApiError).message}`, 'critico');
    }
  }

  // Nace sin permisos ni sucursales: se continua en su pantalla de permisos (RF-00.2, RF-00.8)
  async function crear({ datos, passwordTemporal, foto }: CambiosAdministrador) {
    const creado = await administradoresService.crear({ ...datos, passwordTemporal: passwordTemporal ?? '' });
    await guardarFoto(creado.id, foto);
    cerrarPanel();
    mostrarToast('Administrador creado. Ahora elige sus permisos y sus sucursales.');
    navigate(`/administradores/${creado.id}`);
  }

  async function editar(admin: AdministradorResumen, { datos, foto }: CambiosAdministrador) {
    await administradoresService.actualizar(admin.id, datos);
    await guardarFoto(admin.id, foto);
    cerrarPanel();
    consulta.recargar();
    mostrarToast('Administrador actualizado');
  }

  async function restablecer(admin: AdministradorResumen, passwordTemporal: string) {
    await administradoresService.restablecerPassword(admin.id, passwordTemporal);
    cerrarPanel();
    consulta.recargar();
    mostrarToast('Contraseña restablecida');
  }

  async function accionDirecta(accion: () => Promise<Administrador>, mensaje: string) {
    try {
      await accion();
      consulta.recargar();
      mostrarToast(mensaje);
    } catch (error) {
      mostrarToast((error as ApiError).message, 'critico');
    }
  }

  async function desactivar(admin: AdministradorResumen) {
    setProcesando(true);
    setErrorConfirmacion(null);
    try {
      await administradoresService.cambiarEstado(admin.id, false);
      setDesactivando(null);
      consulta.recargar();
      mostrarToast('Administrador desactivado');
    } catch (error) {
      setErrorConfirmacion((error as ApiError).message);
    } finally {
      setProcesando(false);
    }
  }

  function accionesDe(admin: AdministradorResumen): Accion[] {
    const acciones: Accion[] = [
      { etiqueta: 'Permisos y sucursales', icono: ShieldCheck, alElegir: () => navigate(`/administradores/${admin.id}`) },
      { etiqueta: 'Editar datos', icono: Pencil, alElegir: () => setPanel({ tipo: 'editar', admin }) },
      { etiqueta: 'Restablecer contraseña', icono: KeyRound, alElegir: () => setPanel({ tipo: 'restablecer', admin }) },
    ];
    if (admin.bloqueadoHasta) {
      acciones.push({
        etiqueta: 'Desbloquear',
        icono: LockOpen,
        alElegir: () => accionDirecta(() => administradoresService.desbloquear(admin.id), 'Cuenta desbloqueada'),
      });
    }
    acciones.push(
      admin.activo
        ? {
            etiqueta: 'Desactivar',
            icono: PowerOff,
            peligro: true,
            alElegir: () => {
              setErrorConfirmacion(null);
              setDesactivando(admin);
            },
          }
        : {
            etiqueta: 'Activar',
            icono: Power,
            alElegir: () => accionDirecta(() => administradoresService.cambiarEstado(admin.id, true), 'Administrador activado'),
          },
    );
    return acciones;
  }

  const pagina = consulta.datos;

  return (
    <>
      <header className={styles.encabezado}>
        <h1 className="titulo-pagina">Administradores</h1>
        <Button icono={UserPlus} onClick={() => setPanel({ tipo: 'nuevo' })}>
          Nuevo administrador
        </Button>
      </header>

      <div className={styles.herramientas}>
        <CampoBusqueda etiqueta="Buscar administradores" placeholder="Buscar por nombre o usuario" valor={filtros.search} alBuscar={buscar} />
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
          icono={ShieldCheck}
          titulo="Aún no hay administradores"
          accion={
            <Button icono={UserPlus} onClick={() => setPanel({ tipo: 'nuevo' })}>
              Nuevo administrador
            </Button>
          }
        >
          <p>Cada administrador opera las sucursales que le asignes, con los permisos que le marques.</p>
        </EstadoVacio>
      )}

      {pagina && pagina.meta.total === 0 && hayFiltros && (
        <EstadoVacio
          icono={SearchX}
          titulo="Ningún administrador coincide con la búsqueda"
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
          <Tabla titulo="Administradores de la plataforma">
            <thead>
              <tr>
                <th scope="col">Administrador</th>
                <th scope="col">Acceso</th>
                <th scope="col">Estado</th>
                <th scope="col">Último acceso</th>
                <th scope="col" className={clasesTabla.acciones}>
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagina.data.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <div className={clasesTabla.persona}>
                      <Avatar id={admin.id} nombres={admin.nombres} apellidoPaterno={admin.apellidoPaterno} src={admin.fotoUrl} tamano={32} decorativo />
                      <div>
                        <Link to={`/administradores/${admin.id}`}>
                          <strong>{nombreAdministrador(admin)}</strong>
                        </Link>
                        <span className={styles.usuarioSecundario}>{admin.username}</span>
                      </div>
                    </div>
                  </td>
                  <td data-etiqueta="Acceso" className="cifras-tabulares">
                    {admin.totalPermisos === 0 ? <span className={styles.sinDato}>Sin permisos</span> : resumenAcceso(admin)}
                  </td>
                  <td data-etiqueta="Estado">
                    <EstadoCuenta cuenta={admin} />
                  </td>
                  <td data-etiqueta="Último acceso" className="cifras-tabulares">
                    {admin.ultimoAccesoEn ? fechaHora(admin.ultimoAccesoEn) : <span className={styles.sinDato}>Nunca ha entrado</span>}
                  </td>
                  <td className={`${clasesTabla.acciones} ${clasesTabla.soloMenu}`}>
                    <MenuAcciones etiqueta={`Acciones de ${nombreAdministrador(admin)}`} acciones={accionesDe(admin)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <Paginacion
            meta={pagina.meta}
            nombre="administradores"
            alCambiarPagina={(page) => cambiarFiltros({ page })}
            alCambiarLimite={(limit) => cambiarFiltros({ limit })}
          />
        </div>
      )}

      <PanelLateral
        abierto={panel?.tipo === 'nuevo'}
        titulo="Nuevo administrador"
        descripcion="Empieza sin permisos ni sucursales; los eliges en el siguiente paso."
        alCerrar={cerrarPanel}
      >
        <FormularioAdministrador alGuardar={crear} alCancelar={cerrarPanel} />
      </PanelLateral>

      <PanelLateral abierto={panel?.tipo === 'editar'} titulo="Editar administrador" alCerrar={cerrarPanel}>
        {panel?.tipo === 'editar' && (
          <FormularioAdministrador key={panel.admin.id} administrador={panel.admin} alGuardar={(cambios) => editar(panel.admin, cambios)} alCancelar={cerrarPanel} />
        )}
      </PanelLateral>

      <PanelLateral
        abierto={panel?.tipo === 'restablecer'}
        titulo="Restablecer contraseña"
        descripcion={
          panel?.tipo === 'restablecer'
            ? `Se cerrarán las sesiones de ${nombreAdministrador(panel.admin)} y, al entrar con esta contraseña, deberá crear una nueva.`
            : undefined
        }
        alCerrar={cerrarPanel}
      >
        {panel?.tipo === 'restablecer' && <FormularioRestablecer alGuardar={(password) => restablecer(panel.admin, password)} alCancelar={cerrarPanel} />}
      </PanelLateral>

      <Dialogo
        abierto={desactivando !== null}
        titulo={desactivando ? `¿Desactivar a ${nombreAdministrador(desactivando)}?` : ''}
        textoConfirmar="Desactivar administrador"
        textoCargando="Desactivando…"
        peligro
        cargando={procesando}
        error={errorConfirmacion}
        alConfirmar={() => desactivando && desactivar(desactivando)}
        alCancelar={() => setDesactivando(null)}
      >
        <p>Se cerrarán sus sesiones y no podrá entrar hasta que lo actives de nuevo. Sus permisos, sus sucursales y su historial se conservan.</p>
      </Dialogo>
    </>
  );
}
