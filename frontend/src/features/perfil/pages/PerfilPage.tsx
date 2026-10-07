import { ImageUp, KeyRound, RotateCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Dialogo } from '../../../components/ui/Dialogo';
import { Skeleton } from '../../../components/ui/Skeleton';
import { mostrarToast } from '../../../components/ui/toast.store';
import { NOMBRE_ROL } from '../../../config/menu.config';
import { useConsulta } from '../../../hooks/useConsulta';
import type { ApiError } from '../../../services/api/client';
import { fechaDia, fechaHora } from '../../../utils/formato';
import { useAuthStore } from '../../auth/stores/auth.store';
import type { Perfil } from '../../auth/types/auth.types';
import { perfilService } from '../services/perfil.service';
import styles from './PerfilPage.module.css';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAXIMO_BYTES = 5 * 1024 * 1024;

// HU-06: datos de solo lectura y foto de perfil (RF-01.7, RF-01.9)
export function PerfilPage() {
  const actualizarUsuario = useAuthStore((s) => s.actualizarUsuario);
  const perfil = useConsulta(useCallback(() => perfilService.obtener(), []));
  const entrada = useRef<HTMLInputElement>(null);
  const [nueva, setNueva] = useState<File | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);

  const vistaPrevia = useMemo(() => (nueva ? URL.createObjectURL(nueva) : null), [nueva]);
  useEffect(() => {
    return () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  // La foto nueva se refleja en la barra superior y en la lateral
  function aplicar(actualizado: Perfil, mensaje: string) {
    perfil.reemplazar(actualizado);
    actualizarUsuario(actualizado);
    setNueva(null);
    mostrarToast(mensaje);
  }

  function elegir(archivo: File | undefined) {
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) return setErrorFoto('Elige una imagen JPG, PNG o WebP.');
    if (archivo.size > MAXIMO_BYTES) return setErrorFoto('La foto pesa más de 5 MB. Elige una imagen más ligera.');
    setErrorFoto(null);
    setNueva(archivo);
  }

  async function guardarFoto() {
    if (!nueva) return;
    setGuardando(true);
    setErrorFoto(null);
    try {
      aplicar(await perfilService.cambiarFoto(nueva), 'Foto actualizada');
    } catch (error) {
      setErrorFoto((error as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitarFoto() {
    setGuardando(true);
    try {
      aplicar(await perfilService.quitarFoto(), 'Foto eliminada');
      setConfirmandoQuitar(false);
    } catch (error) {
      setConfirmandoQuitar(false);
      setErrorFoto((error as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  const datos = perfil.datos;

  return (
    <>
      <h1 className={`titulo-pagina ${styles.titulo}`}>Mi perfil</h1>

      {perfil.estado === 'error' && !datos && (
        <div className={styles.errorCarga}>
          <Alerta>{perfil.error.message}</Alerta>
          <Button variante="secundario" icono={RotateCw} onClick={perfil.recargar}>
            Reintentar
          </Button>
        </div>
      )}

      {!datos && perfil.estado === 'cargando' && (
        <div className={styles.cargando} aria-busy="true" aria-label="Cargando tu perfil">
          <Skeleton ancho={96} alto={96} />
          <Skeleton ancho="60%" alto={20} />
          <Skeleton ancho="40%" alto={20} />
        </div>
      )}

      {datos && (
        <div className={styles.contenido}>
          <section className={styles.foto} aria-labelledby="titulo-foto">
            <h2 id="titulo-foto" className="solo-lector">
              Foto de perfil
            </h2>
            <Avatar
              id={datos.id}
              nombres={datos.nombres}
              apellidoPaterno={datos.apellidoPaterno}
              src={vistaPrevia ?? datos.fotoUrl}
              tamano={96}
            />
            <div className={styles.fotoControles}>
              <div className={styles.botones}>
                {nueva ? (
                  <>
                    <Button cargando={guardando} textoCargando="Guardando…" onClick={guardarFoto}>
                      Guardar foto
                    </Button>
                    <Button variante="secundario" onClick={() => setNueva(null)} disabled={guardando}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variante="secundario" icono={ImageUp} onClick={() => entrada.current?.click()}>
                      {datos.fotoUrl ? 'Cambiar foto' : 'Elegir foto'}
                    </Button>
                    {datos.fotoUrl && (
                      <Button variante="texto" icono={Trash2} onClick={() => setConfirmandoQuitar(true)}>
                        Quitar foto
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className={errorFoto ? styles.error : styles.ayuda} aria-live="polite">
                {errorFoto ??
                  (nueva
                    ? 'Así se verá tu foto. Guárdala para que la vean los demás.'
                    : 'JPG, PNG o WebP de hasta 5 MB. Se recorta en cuadrado.')}
              </p>
              <input
                ref={entrada}
                type="file"
                accept={TIPOS.join(',')}
                hidden
                onChange={(e) => {
                  elegir(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </section>

          <section aria-labelledby="titulo-datos">
            <h2 id="titulo-datos" className={styles.seccionTitulo}>
              Tus datos
            </h2>
            <dl className={styles.datos}>
              <div>
                <dt>Nombre</dt>
                <dd>{[datos.nombres, datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ')}</dd>
              </div>
              {datos.username && (
                <div>
                  <dt>Usuario</dt>
                  <dd>{datos.username}</dd>
                </div>
              )}
              {datos.empleado && (
                <div>
                  <dt>Número de empleado</dt>
                  <dd className="cifras-tabulares">{datos.empleado.numeroEmpleado}</dd>
                </div>
              )}
              <div>
                <dt>Rol</dt>
                <dd>{NOMBRE_ROL[datos.rol]}</dd>
              </div>
              {datos.empleado && (
                <>
                  <div>
                    <dt>Puesto</dt>
                    <dd>
                      {datos.empleado.puesto.nombre}
                      <span className={styles.secundario}>{datos.empleado.area.nombre}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Fecha de ingreso</dt>
                    <dd className="cifras-tabulares">{fechaDia(datos.empleado.fechaIngreso)}</dd>
                  </div>
                </>
              )}
              {datos.rol === 'SUPERUSUARIO' && (
                <div>
                  <dt>Alcance</dt>
                  <dd>Toda la plataforma</dd>
                </div>
              )}
              {datos.sucursal && (
                <div>
                  <dt>Sucursal</dt>
                  <dd>
                    {datos.sucursal.nombre}
                    <span className={styles.secundario}>
                      {datos.sucursal.empresa.nombre} · {datos.sucursal.marca.nombre}
                    </span>
                  </dd>
                </div>
              )}
              {datos.rol === 'ADMIN' && (
                <div>
                  <dt>Sucursales a tu cargo</dt>
                  <dd>
                    {datos.sucursales.length === 0 ? (
                      'Ninguna todavía'
                    ) : (
                      <ul className={styles.lista}>
                        {datos.sucursales.map((s) => (
                          <li key={s.id}>
                            {s.nombre}
                            <span className={styles.secundario}>
                              {s.empresa.nombre} · {s.marca.nombre}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            {datos.rol !== 'SUPERUSUARIO' && (
              <p className={styles.nota}>
                {datos.rol === 'ADMIN'
                  ? 'Si un dato es incorrecto o necesitas otros permisos, pídeselo al superusuario.'
                  : 'Si un dato es incorrecto, pide a tu administrador que lo corrija.'}
              </p>
            )}
          </section>

          <section aria-labelledby="titulo-seguridad">
            <h2 id="titulo-seguridad" className={styles.seccionTitulo}>
              Seguridad
            </h2>
            <dl className={styles.datos}>
              <div>
                <dt>Último inicio de sesión</dt>
                <dd className="cifras-tabulares">{datos.ultimoAccesoEn ? fechaHora(datos.ultimoAccesoEn) : 'Sin registro'}</dd>
              </div>
            </dl>
            <Link to="/cambiar-password" className={styles.enlaceBoton}>
              <KeyRound size={20} strokeWidth={1.75} aria-hidden="true" />
              Cambiar contraseña
            </Link>
          </section>
        </div>
      )}

      <Dialogo
        abierto={confirmandoQuitar}
        titulo="¿Quitar tu foto de perfil?"
        textoConfirmar="Quitar foto"
        textoCargando="Quitando…"
        peligro
        cargando={guardando}
        alConfirmar={quitarFoto}
        alCancelar={() => setConfirmandoQuitar(false)}
      >
        <p>En su lugar se mostrarán tus iniciales. Puedes subir otra foto cuando quieras.</p>
      </Dialogo>
    </>
  );
}
