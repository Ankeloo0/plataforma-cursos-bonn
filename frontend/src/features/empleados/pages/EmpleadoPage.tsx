import { Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { MenuAcciones } from '../../../components/ui/MenuAcciones';
import pagina from '../../../components/ui/Pagina.module.css';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConsulta } from '../../../hooks/useConsulta';
import { fechaDia, fechaHora } from '../../../utils/formato';
import { puede } from '../../../utils/permisos';
import { EstadoCuenta } from '../../administradores/components/EstadoCuenta';
import { useAuthStore } from '../../auth/stores/auth.store';
import { catalogoService } from '../../catalogo/services/catalogo.service';
import { sucursalesService } from '../../empresas/services/sucursales.service';
import { GestionEmpleado } from '../components/GestionEmpleado';
import { accionesDeEmpleado, nombreEmpleado, type AccionEmpleado } from '../utils/empleado';
import { empleadosService } from '../services/empleados.service';
import styles from './EmpleadoPage.module.css';

// Ficha del empleado (RF-03.6). Cursos, evaluaciones y certificados se agregan con los cursos (I4 a I6).
export function EmpleadoPage() {
  const { id = '' } = useParams();
  const usuario = useAuthStore((s) => s.usuario);
  const detalle = useConsulta(useCallback(() => empleadosService.obtener(id), [id]));
  const [accion, setAccion] = useState<AccionEmpleado>(null);
  const gestionar = puede(usuario, 'EMPLEADOS_GESTIONAR');

  // Solo se piden si puede editar: el formulario las necesita
  const sucursales = useConsulta(useCallback(() => (gestionar ? sucursalesService.listarEnAlcance() : Promise.resolve([])), [gestionar]));
  const puestos = useConsulta(useCallback(() => (gestionar ? catalogoService.listarPuestos() : Promise.resolve([])), [gestionar]));

  if (detalle.estado === 'error' && !detalle.datos) {
    return (
      <div className={pagina.errorCarga}>
        <Alerta>{detalle.error.statusCode === 404 ? 'Este empleado no existe o no está en tus sucursales.' : detalle.error.message}</Alerta>
        <Link to="/empleados">Volver a empleados</Link>
      </div>
    );
  }

  const empleado = detalle.datos;
  const acciones = empleado ? accionesDeEmpleado(empleado, usuario, setAccion, detalle.recargar, { editar: false }) : [];

  return (
    <>
      <nav aria-label="Ruta" className={pagina.migas}>
        <ol>
          <li>
            <Link to="/empleados">Empleados</Link>
          </li>
          <li aria-current="page">{empleado ? nombreEmpleado(empleado) : '…'}</li>
        </ol>
      </nav>

      {!empleado ? (
        <div className={styles.cargando} aria-busy="true" aria-label="Cargando empleado">
          <Skeleton ancho={360} alto={56} />
          <Skeleton alto={180} />
        </div>
      ) : (
        <>
          <header className={styles.encabezado}>
            <Avatar id={empleado.usuarioId} nombres={empleado.nombres} apellidoPaterno={empleado.apellidoPaterno} src={empleado.fotoUrl} tamano={96} decorativo />
            <div className={styles.identidad}>
              <h1 className="titulo-pagina">{nombreEmpleado(empleado)}</h1>
              <div className={styles.identidadDatos}>
                <span className="cifras-tabulares">No. {empleado.numeroEmpleado}</span>
                <span>{empleado.puesto.nombre}</span>
                <EstadoCuenta cuenta={empleado} />
              </div>
            </div>
            <div className={pagina.accionesEncabezado}>
              {gestionar && (
                <Button icono={Pencil} variante="secundario" onClick={() => setAccion({ tipo: 'editar', empleado })}>
                  Editar
                </Button>
              )}
              {acciones.length > 0 && <MenuAcciones etiqueta={`Más acciones de ${nombreEmpleado(empleado)}`} acciones={acciones} />}
            </div>
          </header>

          <section aria-labelledby="titulo-laborales">
            <h2 id="titulo-laborales" className={`${pagina.seccionTitulo} ${styles.tituloSeccion}`}>
              Datos laborales
            </h2>
            <dl className={pagina.datos}>
              <div>
                <dt>Número de empleado</dt>
                <dd className="cifras-tabulares">{empleado.numeroEmpleado}</dd>
              </div>
              <div>
                <dt>Puesto</dt>
                <dd>
                  {empleado.puesto.nombre}
                  <span className={pagina.datoSecundario}>{empleado.area.nombre}</span>
                </dd>
              </div>
              <div>
                <dt>Sucursal</dt>
                <dd>
                  {empleado.sucursal.nombre}
                  <span className={pagina.datoSecundario}>
                    {empleado.empresa.nombre} · {empleado.marca.nombre}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Fecha de ingreso</dt>
                <dd className="cifras-tabulares">{fechaDia(empleado.fechaIngreso)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="titulo-cuenta">
            <h2 id="titulo-cuenta" className={`${pagina.seccionTitulo} ${styles.tituloSeccion}`}>
              Cuenta
            </h2>
            <dl className={pagina.datos}>
              <div>
                <dt>Inicia sesión con</dt>
                <dd>
                  {empleado.empresa.nombre}
                  <span className={`${pagina.datoSecundario} cifras-tabulares`}>Número {empleado.numeroEmpleado} y su contraseña</span>
                </dd>
              </div>
              <div>
                <dt>Último acceso</dt>
                <dd className="cifras-tabulares">
                  {empleado.ultimoAccesoEn ? fechaHora(empleado.ultimoAccesoEn) : <span className={pagina.sinDato}>Nunca ha entrado</span>}
                </dd>
              </div>
              <div>
                <dt>Dado de alta</dt>
                <dd>
                  <span className="cifras-tabulares">{fechaHora(empleado.creadoEn)}</span>
                  {empleado.creadoPor && <span className={pagina.datoSecundario}>por {empleado.creadoPor}</span>}
                </dd>
              </div>
              <div>
                <dt>Última modificación</dt>
                <dd>
                  {empleado.actualizadoPor ? (
                    <>
                      <span className="cifras-tabulares">{fechaHora(empleado.actualizadoEn)}</span>
                      <span className={pagina.datoSecundario}>por {empleado.actualizadoPor}</span>
                    </>
                  ) : (
                    <span className={pagina.sinDato}>Sin cambios desde el alta</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}

      <GestionEmpleado
        accion={accion}
        sucursales={sucursales.datos ?? []}
        puestos={puestos.datos ?? []}
        alCerrar={() => setAccion(null)}
        alCambiar={(editado) => (editado ? detalle.reemplazar(editado) : detalle.recargar())}
      />
    </>
  );
}
