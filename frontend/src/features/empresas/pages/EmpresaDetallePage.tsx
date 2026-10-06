import { CircleAlert, CircleCheck, CircleMinus, MapPinPlus, Pencil, Power, PowerOff, RotateCw, Store } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
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
import { fechaHora } from '../../../utils/formato';
import { marcasService } from '../../marcas/services/marcas.service';
import { FormularioEmpresa } from '../components/FormularioEmpresa';
import { FormularioSucursal } from '../components/FormularioSucursal';
import { empresasService } from '../services/empresas.service';
import { sucursalesService } from '../services/sucursales.service';
import type { DatosEmpresa, DatosSucursal, Sucursal } from '../types/empresas.types';
import styles from '../../../components/ui/Pagina.module.css';

type Panel = { tipo: 'editar-empresa' } | { tipo: 'nueva-sucursal' } | { tipo: 'editar-sucursal'; sucursal: Sucursal } | null;

type Confirmacion = { tipo: 'desactivar-empresa' } | { tipo: 'desactivar-sucursal'; sucursal: Sucursal } | null;

export function EmpresaDetallePage() {
  const { id = '' } = useParams();
  const ubicacion = useLocation();
  const vieneDeCrear = (ubicacion.state as { nuevaSucursal?: boolean } | null)?.nuevaSucursal === true;
  const [panel, setPanel] = useState<Panel>(vieneDeCrear ? { tipo: 'nueva-sucursal' } : null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);

  const empresa = useConsulta(useCallback(() => empresasService.obtener(id), [id]));
  const sucursales = useConsulta(useCallback(() => sucursalesService.listarDeEmpresa(id), [id]));
  const marcas = useConsulta(useCallback(() => marcasService.listar(), []));

  const cerrarPanel = () => setPanel(null);
  const recargarTodo = () => {
    empresa.recargar();
    sucursales.recargar();
  };

  async function editarEmpresa(datos: DatosEmpresa) {
    empresa.reemplazar(await empresasService.actualizar(id, datos));
    cerrarPanel();
    mostrarToast('Empresa actualizada');
  }

  async function cambiarEstadoEmpresa(activo: boolean) {
    setProcesando(true);
    setErrorConfirmacion(null);
    try {
      empresa.reemplazar(await empresasService.cambiarEstado(id, activo));
      setConfirmacion(null);
      mostrarToast(activo ? 'Empresa activada' : 'Empresa desactivada');
    } catch (error) {
      if (activo) mostrarToast((error as ApiError).message, 'critico');
      else setErrorConfirmacion((error as ApiError).message);
    } finally {
      setProcesando(false);
    }
  }

  async function crearSucursal(datos: DatosSucursal) {
    await sucursalesService.crear(id, datos);
    cerrarPanel();
    recargarTodo();
    mostrarToast('Sucursal creada');
  }

  async function editarSucursal(sucursal: Sucursal, datos: DatosSucursal) {
    await sucursalesService.actualizar(sucursal.id, datos);
    cerrarPanel();
    sucursales.recargar();
    mostrarToast('Sucursal actualizada');
  }

  async function cambiarEstadoSucursal(sucursal: Sucursal, activo: boolean) {
    setProcesando(true);
    setErrorConfirmacion(null);
    try {
      await sucursalesService.cambiarEstado(sucursal.id, activo);
      setConfirmacion(null);
      recargarTodo();
      mostrarToast(activo ? 'Sucursal activada' : 'Sucursal desactivada');
    } catch (error) {
      if (activo) mostrarToast((error as ApiError).message, 'critico');
      else setErrorConfirmacion((error as ApiError).message);
    } finally {
      setProcesando(false);
    }
  }

  function accionesDe(sucursal: Sucursal): Accion[] {
    return [
      { etiqueta: 'Editar', icono: Pencil, alElegir: () => setPanel({ tipo: 'editar-sucursal', sucursal }) },
      sucursal.activo
        ? {
            etiqueta: 'Desactivar',
            icono: PowerOff,
            peligro: true,
            alElegir: () => abrirConfirmacion({ tipo: 'desactivar-sucursal', sucursal }),
          }
        : { etiqueta: 'Activar', icono: Power, alElegir: () => cambiarEstadoSucursal(sucursal, true) },
    ];
  }

  function abrirConfirmacion(c: Confirmacion) {
    setErrorConfirmacion(null);
    setConfirmacion(c);
  }

  if (empresa.estado === 'error' && !empresa.datos) {
    return (
      <div className={styles.errorCarga}>
        <Alerta>{empresa.error.statusCode === 404 ? 'Esta empresa no existe.' : empresa.error.message}</Alerta>
        <Link to="/empresas">Volver a empresas</Link>
      </div>
    );
  }

  const datos = empresa.datos;
  const lista = sucursales.datos;
  const listaMarcas = marcas.datos ?? [];
  const sinMarcasActivas = marcas.estado === 'listo' && !listaMarcas.some((m) => m.activo);

  return (
    <>
      <nav aria-label="Ruta" className={styles.migas}>
        <ol>
          <li>
            <Link to="/empresas">Empresas</Link>
          </li>
          <li aria-current="page">{datos?.nombre ?? '…'}</li>
        </ol>
      </nav>

      <header className={styles.encabezado}>
        <div className={styles.titulo}>
          {datos ? <h1 className="titulo-pagina">{datos.nombre}</h1> : <Skeleton ancho={320} alto={40} />}
          {datos &&
            (datos.activo ? (
              <Chip tono="exito" icono={CircleCheck}>
                Activa
              </Chip>
            ) : (
              <Chip icono={CircleMinus}>Inactiva</Chip>
            ))}
        </div>
        {datos && (
          <div className={styles.accionesEncabezado}>
            <Button variante="secundario" icono={Pencil} onClick={() => setPanel({ tipo: 'editar-empresa' })}>
              Editar
            </Button>
            {datos.activo ? (
              <Button variante="secundario" icono={PowerOff} onClick={() => abrirConfirmacion({ tipo: 'desactivar-empresa' })}>
                Desactivar empresa
              </Button>
            ) : (
              <Button variante="secundario" icono={Power} cargando={procesando} textoCargando="Activando…" onClick={() => cambiarEstadoEmpresa(true)}>
                Activar empresa
              </Button>
            )}
          </div>
        )}
      </header>

      {datos ? (
        <dl className={styles.datos}>
          <div>
            <dt>Razón social</dt>
            <dd>{datos.razonSocial ?? <span className={styles.sinDato}>Sin registrar</span>}</dd>
          </div>
          <div>
            <dt>Prefijo del folio</dt>
            <dd className="cifras-tabulares">
              {datos.prefijoFolio}
              <span className={styles.datoSecundario}>p. ej. {datos.prefijoFolio}-2026-000123</span>
            </dd>
          </div>
          <div>
            <dt>Creada</dt>
            <dd>
              {fechaHora(datos.creadoEn)}
              {datos.creadoPor && <span className={styles.datoSecundario}>por {datos.creadoPor}</span>}
            </dd>
          </div>
          <div>
            <dt>Última modificación</dt>
            <dd>
              {datos.actualizadoPor ? (
                <>
                  {fechaHora(datos.actualizadoEn)}
                  <span className={styles.datoSecundario}>por {datos.actualizadoPor}</span>
                </>
              ) : (
                <span className={styles.sinDato}>Sin cambios desde su creación</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <div className={styles.datos}>
          <Skeleton alto={40} />
          <Skeleton alto={40} />
          <Skeleton alto={40} />
        </div>
      )}

      <section aria-labelledby="titulo-sucursales">
        <div className={styles.seccion}>
          <h2 id="titulo-sucursales" className={styles.seccionTitulo}>
            Sucursales
          </h2>
          {lista && lista.length > 0 && (
            <Button variante="secundario" icono={MapPinPlus} onClick={() => setPanel({ tipo: 'nueva-sucursal' })}>
              Nueva sucursal
            </Button>
          )}
        </div>

        {sucursales.estado === 'error' && (
          <div className={styles.errorCarga}>
            <Alerta>{sucursales.error.message}</Alerta>
            <Button variante="secundario" icono={RotateCw} onClick={sucursales.recargar}>
              Reintentar
            </Button>
          </div>
        )}

        {!lista && sucursales.estado === 'cargando' && <Skeleton alto={104} />}

        {lista && lista.length === 0 && (
          <EstadoVacio
            icono={Store}
            titulo="Esta empresa todavía no tiene sucursales"
            accion={
              <Button icono={MapPinPlus} onClick={() => setPanel({ tipo: 'nueva-sucursal' })}>
                Nueva sucursal
              </Button>
            }
          >
            <p>Cada sucursal vende una marca y tiene sus propios empleados. Después asignarás administradores que la operen.</p>
          </EstadoVacio>
        )}

        {lista && lista.length > 0 && (
          <Tabla titulo={`Sucursales de ${datos?.nombre ?? 'la empresa'}`}>
            <thead>
              <tr>
                <th scope="col">Sucursal</th>
                <th scope="col">Marca</th>
                <th scope="col">Administradores</th>
                <th scope="col" className={clasesTabla.numero}>
                  Empleados activos
                </th>
                <th scope="col">Estado</th>
                <th scope="col" className={clasesTabla.acciones}>
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((sucursal) => (
                <tr key={sucursal.id}>
                  <td>
                    <strong>{sucursal.nombre}</strong>
                    {sucursal.direccion && <span className={clasesTabla.secundario}>{sucursal.direccion}</span>}
                  </td>
                  <td data-etiqueta="Marca">{sucursal.marca.nombre}</td>
                  <td data-etiqueta="Administradores">
                    {sucursal.administradores.length > 0 ? (
                      sucursal.administradores.map((a) => a.nombre).join(', ')
                    ) : (
                      <Chip tono="aviso" icono={CircleAlert}>
                        Sin administrador
                      </Chip>
                    )}
                  </td>
                  <td data-etiqueta="Empleados activos" className={clasesTabla.numero}>
                    {sucursal.empleadosActivos.toLocaleString('es-MX')}
                  </td>
                  <td data-etiqueta="Estado">
                    {sucursal.activo ? (
                      <Chip tono="exito" icono={CircleCheck}>
                        Activa
                      </Chip>
                    ) : (
                      <Chip icono={CircleMinus}>Inactiva</Chip>
                    )}
                  </td>
                  <td className={`${clasesTabla.acciones} ${clasesTabla.soloMenu}`}>
                    <MenuAcciones etiqueta={`Acciones de ${sucursal.nombre}`} acciones={accionesDe(sucursal)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </section>

      <PanelLateral abierto={panel?.tipo === 'editar-empresa'} titulo="Editar empresa" alCerrar={cerrarPanel}>
        {datos && <FormularioEmpresa empresa={datos} alGuardar={editarEmpresa} alCancelar={cerrarPanel} />}
      </PanelLateral>

      <PanelLateral
        abierto={panel?.tipo === 'nueva-sucursal'}
        titulo="Nueva sucursal"
        descripcion={datos ? `Sucursal de ${datos.nombre}.` : undefined}
        alCerrar={cerrarPanel}
      >
        {sinMarcasActivas ? (
          <Alerta>
            No hay marcas activas. <Link to="/marcas">Registra la marca</Link> que vende la sucursal antes de crearla.
          </Alerta>
        ) : (
          <FormularioSucursal marcas={listaMarcas} alGuardar={crearSucursal} alCancelar={cerrarPanel} />
        )}
      </PanelLateral>

      <PanelLateral abierto={panel?.tipo === 'editar-sucursal'} titulo="Editar sucursal" alCerrar={cerrarPanel}>
        {panel?.tipo === 'editar-sucursal' && (
          <FormularioSucursal
            key={panel.sucursal.id}
            sucursal={panel.sucursal}
            marcas={listaMarcas}
            alGuardar={(cambios) => editarSucursal(panel.sucursal, cambios)}
            alCancelar={cerrarPanel}
          />
        )}
      </PanelLateral>

      <Dialogo
        abierto={confirmacion?.tipo === 'desactivar-empresa'}
        titulo={`¿Desactivar ${datos?.nombre ?? 'la empresa'}?`}
        textoConfirmar="Desactivar empresa"
        textoCargando="Desactivando…"
        peligro
        cargando={procesando}
        error={errorConfirmacion}
        alConfirmar={() => cambiarEstadoEmpresa(false)}
        alCancelar={() => setConfirmacion(null)}
      >
        <p>
          Sus {datos?.empleadosActivos ?? 0} empleados activos no podrán iniciar sesión, y sus {datos?.sucursalesActivas ?? 0}{' '}
          sucursales dejarán de aparecer a sus administradores.
        </p>
        <p>Sus datos se conservan; puedes activarla de nuevo cuando quieras.</p>
      </Dialogo>

      <Dialogo
        abierto={confirmacion?.tipo === 'desactivar-sucursal'}
        titulo={confirmacion?.tipo === 'desactivar-sucursal' ? `¿Desactivar ${confirmacion.sucursal.nombre}?` : ''}
        textoConfirmar="Desactivar sucursal"
        textoCargando="Desactivando…"
        peligro
        cargando={procesando}
        error={errorConfirmacion}
        alConfirmar={() => confirmacion?.tipo === 'desactivar-sucursal' && cambiarEstadoSucursal(confirmacion.sucursal, false)}
        alCancelar={() => setConfirmacion(null)}
      >
        <p>
          Sus {confirmacion?.tipo === 'desactivar-sucursal' ? confirmacion.sucursal.empleadosActivos : 0} empleados activos no
          podrán iniciar sesión y sus administradores dejarán de operarla. Sus datos se conservan.
        </p>
      </Dialogo>
    </>
  );
}
