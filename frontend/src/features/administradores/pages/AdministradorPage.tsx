import { CircleMinus, Info, RotateCw, Search } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';
import { Link, useBeforeUnload, useBlocker, useParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { Dialogo } from '../../../components/ui/Dialogo';
import pagina from '../../../components/ui/Pagina.module.css';
import { Skeleton } from '../../../components/ui/Skeleton';
import { mostrarToast } from '../../../components/ui/toast.store';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import type { Permiso } from '../../auth/types/auth.types';
import { sucursalesService } from '../../empresas/services/sucursales.service';
import type { Sucursal } from '../../empresas/types/empresas.types';
import { EstadoCuenta } from '../components/EstadoCuenta';
import { administradoresService } from '../services/administradores.service';
import type { DescripcionPermiso, GrupoPermisos } from '../types/administradores.types';
import { nombreAdministrador } from '../utils/nombre';
import styles from './AdministradorPage.module.css';

const GRUPOS: { grupo: GrupoPermisos; titulo: string }[] = [
  { grupo: 'CATALOGOS', titulo: 'Catálogos' },
  { grupo: 'EMPLEADOS', titulo: 'Empleados' },
  { grupo: 'CURSOS', titulo: 'Cursos' },
  { grupo: 'RESULTADOS', titulo: 'Resultados' },
  { grupo: 'ASISTENTE', titulo: 'Asistente' },
];

interface Acceso {
  permisos: Permiso[];
  sucursalIds: string[];
}

const mismoConjunto = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

// Pantalla de permisos (RF-00.8, design-reference 10.7): que puede hacer un administrador y en que sucursales
export function AdministradorPage() {
  const { id = '' } = useParams();
  const detalle = useConsulta(useCallback(() => administradoresService.obtener(id), [id]));
  const catalogo = useConsulta(useCallback(() => administradoresService.catalogo(), []));
  const sucursales = useConsulta(useCallback(() => sucursalesService.listarEnAlcance(), []));
  // null = sin cambios: se muestra lo guardado
  const [cambios, setCambios] = useState<Acceso | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idBusqueda = useId();

  const guardado = useMemo<Acceso | null>(
    () => (detalle.datos ? { permisos: detalle.datos.permisos, sucursalIds: detalle.datos.sucursales.map((s) => s.id) } : null),
    [detalle.datos],
  );
  const acceso = cambios ?? guardado;
  const hayCambios =
    cambios !== null &&
    guardado !== null &&
    (!mismoConjunto(cambios.permisos, guardado.permisos) || !mismoConjunto(cambios.sucursalIds, guardado.sucursalIds));

  const bloqueo = useBlocker(hayCambios);
  useBeforeUnload(
    useCallback(
      (evento: BeforeUnloadEvent) => {
        if (hayCambios) evento.preventDefault();
      },
      [hayCambios],
    ),
  );

  const grupos = useMemo(() => agruparPorEmpresa(sucursales.datos ?? [], busqueda), [sucursales.datos, busqueda]);

  function cambiar(siguiente: (actual: Acceso) => Acceso) {
    if (!acceso) return;
    setError(null);
    setCambios(siguiente(acceso));
  }

  const alternarPermiso = (permiso: Permiso) =>
    cambiar((a) => ({
      ...a,
      permisos: a.permisos.includes(permiso) ? a.permisos.filter((p) => p !== permiso) : [...a.permisos, permiso],
    }));

  const alternarSucursal = (sucursalId: string) =>
    cambiar((a) => ({
      ...a,
      sucursalIds: a.sucursalIds.includes(sucursalId) ? a.sucursalIds.filter((s) => s !== sucursalId) : [...a.sucursalIds, sucursalId],
    }));

  async function guardar() {
    if (!cambios) return;
    setGuardando(true);
    setError(null);
    try {
      detalle.reemplazar(await administradoresService.guardarAcceso(id, cambios.permisos, cambios.sucursalIds));
      setCambios(null);
      mostrarToast('Permisos y sucursales guardados');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  if (detalle.estado === 'error' && !detalle.datos) {
    return (
      <div className={pagina.errorCarga}>
        <Alerta>{detalle.error.statusCode === 404 ? 'Este administrador no existe.' : detalle.error.message}</Alerta>
        <Link to="/administradores">Volver a administradores</Link>
      </div>
    );
  }

  const admin = detalle.datos;
  const cargandoCatalogos = !catalogo.datos || !sucursales.datos;

  return (
    <>
      <nav aria-label="Ruta" className={pagina.migas}>
        <ol>
          <li>
            <Link to="/administradores">Administradores</Link>
          </li>
          <li aria-current="page">{admin ? nombreAdministrador(admin) : '…'}</li>
        </ol>
      </nav>

      <header className={styles.encabezado}>
        {admin ? (
          <>
            <Avatar id={admin.id} nombres={admin.nombres} apellidoPaterno={admin.apellidoPaterno} src={admin.fotoUrl} tamano={40} decorativo />
            <div className={styles.identidad}>
              <h1 className="titulo-pagina">{nombreAdministrador(admin)}</h1>
              <div className={styles.identidadDatos}>
                <span>{admin.username}</span>
                <EstadoCuenta cuenta={admin} />
              </div>
            </div>
          </>
        ) : (
          <Skeleton ancho={360} alto={56} />
        )}
      </header>

      {(catalogo.estado === 'error' || sucursales.estado === 'error') && (
        <div className={pagina.errorCarga}>
          <Alerta>{catalogo.estado === 'error' ? catalogo.error.message : sucursales.estado === 'error' ? sucursales.error.message : ''}</Alerta>
          <Button
            variante="secundario"
            icono={RotateCw}
            onClick={() => {
              catalogo.recargar();
              sucursales.recargar();
            }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {(!acceso || cargandoCatalogos) && catalogo.estado !== 'error' && sucursales.estado !== 'error' && (
        <div className={styles.cargando} aria-busy="true" aria-label="Cargando permisos">
          <Skeleton alto={48} />
          <Skeleton alto={220} />
          <Skeleton alto={220} />
        </div>
      )}

      {acceso && catalogo.datos && sucursales.datos && (
        <div className={styles.contenido}>
          <section aria-labelledby="titulo-permisos" className={styles.seccion}>
            <div className={styles.seccionEncabezado}>
              <h2 id="titulo-permisos" className={pagina.seccionTitulo}>
                ¿Qué puede hacer?
              </h2>
              <div className={styles.plantillas} role="group" aria-label="Plantillas de permisos">
                <span className={styles.plantillasEtiqueta}>Plantillas:</span>
                {catalogo.datos.plantillas.map((plantilla) => (
                  <Button
                    key={plantilla.clave}
                    variante="secundario"
                    tamano="compacto"
                    onClick={() => cambiar((a) => ({ ...a, permisos: plantilla.permisos }))}
                  >
                    {plantilla.nombre}
                  </Button>
                ))}
              </div>
            </div>
            <p className={styles.ayuda}>Una plantilla marca varias casillas a la vez; después puedes ajustarlas una por una.</p>

            {acceso.permisos.length === 0 && (
              <Alerta tono="info">Este administrador no puede hacer nada todavía. Marca al menos un permiso.</Alerta>
            )}

            <div className={styles.grupos}>
              {GRUPOS.map(({ grupo, titulo }) => {
                const permisos = catalogo.datos!.permisos.filter((p) => p.grupo === grupo);
                return (
                  <fieldset key={grupo} className={styles.tarjeta}>
                    <legend className={styles.tarjetaTitulo}>{titulo}</legend>
                    {permisos.map((p) => (
                      <CasillaPermiso key={p.permiso} permiso={p} marcado={acceso.permisos.includes(p.permiso)} alCambiar={() => alternarPermiso(p.permiso)} />
                    ))}
                  </fieldset>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="titulo-sucursales" className={styles.seccion}>
            <div className={styles.seccionEncabezado}>
              <h2 id="titulo-sucursales" className={pagina.seccionTitulo}>
                ¿En qué sucursales?
              </h2>
              <div className={styles.busqueda}>
                <label htmlFor={idBusqueda} className="solo-lector">
                  Buscar sucursales
                </label>
                <Search size={18} strokeWidth={1.75} aria-hidden="true" />
                <input
                  id={idBusqueda}
                  type="search"
                  placeholder="Buscar sucursal, empresa o marca"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
            <p className={styles.ayuda}>
              Los permisos de empleados, cursos y resultados aplican en estas sucursales. Una sucursal nueva no se agrega sola.
            </p>

            {sucursales.datos.length === 0 && (
              <Alerta tono="info">
                Todavía no hay sucursales. Créalas desde <Link to="/empresas">Empresas</Link>.
              </Alerta>
            )}
            {sucursales.datos.length > 0 && grupos.length === 0 && <p className={styles.ayuda}>Ninguna sucursal coincide con “{busqueda}”.</p>}

            <div className={styles.empresas}>
              {grupos.map((g) => (
                <fieldset key={g.empresaId} className={styles.tarjeta}>
                  <legend className={styles.tarjetaTitulo}>{g.empresa}</legend>
                  {g.sucursales.map((s) => (
                    <label key={s.id} className={styles.casilla}>
                      <input type="checkbox" checked={acceso.sucursalIds.includes(s.id)} onChange={() => alternarSucursal(s.id)} />
                      <span className={styles.casillaTexto}>
                        <span className={styles.casillaNombre}>
                          {s.nombre}
                          {(!s.activo || !s.empresa.activo) && (
                            <Chip icono={CircleMinus}>{s.activo ? 'Empresa inactiva' : 'Inactiva'}</Chip>
                          )}
                        </span>
                        <span className={styles.casillaDescripcion}>
                          {s.marca.nombre}
                          {s.direccion ? ` · ${s.direccion}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </section>
        </div>
      )}

      {acceso && (
        <div className={styles.barra} role="region" aria-label="Guardar cambios">
          <p className={`cifras-tabulares ${styles.resumen}`}>
            {acceso.permisos.length} {acceso.permisos.length === 1 ? 'permiso' : 'permisos'} · {acceso.sucursalIds.length}{' '}
            {acceso.sucursalIds.length === 1 ? 'sucursal' : 'sucursales'}
            {hayCambios && <span className={styles.pendiente}> · Cambios sin guardar</span>}
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.barraAcciones}>
            <Button variante="secundario" disabled={!hayCambios || guardando} motivoDeshabilitado="No hay cambios" onClick={() => setCambios(null)}>
              Descartar
            </Button>
            <Button disabled={!hayCambios} motivoDeshabilitado="No hay cambios" cargando={guardando} textoCargando="Guardando…" onClick={guardar}>
              Guardar cambios
            </Button>
          </div>
        </div>
      )}

      <Dialogo
        abierto={bloqueo.state === 'blocked'}
        titulo="¿Salir sin guardar?"
        textoConfirmar="Salir sin guardar"
        peligro
        alConfirmar={() => bloqueo.proceed?.()}
        alCancelar={() => bloqueo.reset?.()}
      >
        <p>Los cambios en los permisos y las sucursales de este administrador se perderán.</p>
      </Dialogo>
    </>
  );
}

function CasillaPermiso({ permiso, marcado, alCambiar }: { permiso: DescripcionPermiso; marcado: boolean; alCambiar: () => void }) {
  return (
    <label className={styles.casilla}>
      <input type="checkbox" checked={marcado} onChange={alCambiar} />
      <span className={styles.casillaTexto}>
        <span className={styles.casillaNombre}>{permiso.nombre}</span>
        <span className={styles.casillaDescripcion}>{permiso.descripcion}</span>
        <span className={styles.casillaAlcance}>
          <Info size={14} strokeWidth={1.75} aria-hidden="true" />
          {permiso.alcance === 'TODA_LA_PLATAFORMA' ? 'En toda la plataforma' : 'En sus sucursales'}
        </span>
      </span>
    </label>
  );
}

interface GrupoEmpresa {
  empresaId: string;
  empresa: string;
  sucursales: Sucursal[];
}

function agruparPorEmpresa(sucursales: Sucursal[], busqueda: string): GrupoEmpresa[] {
  const texto = busqueda.trim().toLocaleLowerCase('es-MX');
  const grupos = new Map<string, GrupoEmpresa>();
  for (const s of sucursales) {
    const coincide = !texto || [s.nombre, s.empresa.nombre, s.marca.nombre].some((v) => v.toLocaleLowerCase('es-MX').includes(texto));
    if (!coincide) continue;
    const grupo = grupos.get(s.empresa.id) ?? { empresaId: s.empresa.id, empresa: s.empresa.nombre, sucursales: [] };
    grupo.sucursales.push(s);
    grupos.set(s.empresa.id, grupo);
  }
  return [...grupos.values()];
}
