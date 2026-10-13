import { ArrowLeft, CalendarClock, CircleDot, Clock, Eye, EyeOff, RotateCw } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { Alerta } from '../../../components/ui/Alerta';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { EstadoVacio } from '../../../components/ui/EstadoVacio';
import pagina from '../../../components/ui/Pagina.module.css';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConsulta } from '../../../hooks/useConsulta';
import { fechaDia } from '../../../utils/formato';
import { VisorCurso } from '../components/VisorCurso';
import { contenidoService } from '../services/contenido.service';
import { cursosService } from '../services/cursos.service';
import { duracion } from '../utils/curso';
import styles from './VistaPreviaCursoPage.module.css';

//el curso como lo vera un empleado, sin registrar avance y sin el menu del panel
export function VistaPreviaCursoPage() {
  const { id = '' } = useParams();
  const curso = useConsulta(useCallback(() => cursosService.obtener(id), [id]));
  const temas = useConsulta(useCallback(() => contenidoService.listarTemas(id), [id]));
  const editor = `/cursos/${id}/editar`;

  if (curso.estado === 'error' && !curso.datos) {
    return (
      <div className={styles.pantalla}>
        <main className={styles.contenido}>
          <div className={pagina.errorCarga}>
            <Alerta>{curso.error.statusCode === 404 ? 'Este curso no existe o no puedes verlo.' : curso.error.message}</Alerta>
            <Link to="/cursos">Volver a cursos</Link>
          </div>
        </main>
      </div>
    );
  }

  const datos = curso.datos;
  //el empleado no ve lo oculto
  const visibles = temas.datos?.filter((t) => t.activo).map((t) => ({ ...t, materiales: t.materiales.filter((m) => m.activo) }));

  return (
    <div className={styles.pantalla}>
      <header className={styles.barra}>
        <Link to={editor} className={styles.volver}>
          <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          Volver al editor
        </Link>
        <span className={styles.nombreCurso}>{datos?.titulo ?? '…'}</span>
        <span className={styles.etiqueta}>
          <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
          Vista previa
        </span>
      </header>

      <main className={styles.contenido}>
        <div className={styles.aviso}>
          <Alerta tono="info">Vista previa: así verá el curso un empleado. Aquí no se registra avance.</Alerta>
        </div>

        {!datos ? (
          <div className={styles.cargandoEncabezado} aria-busy="true" aria-label="Cargando curso">
            <Skeleton ancho={420} alto={44} />
            <Skeleton ancho={220} alto={24} />
          </div>
        ) : (
          <header className={styles.encabezado}>
            <h1 className={`titulo-pagina ${styles.titulo}`}>{datos.titulo}</h1>
            <div className={styles.datos}>
              <span className={styles.dato}>
                <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className="cifras-tabulares">{datos.duracionHoras > 0 ? duracion(datos.duracionHoras) : 'Sin duración'}</span>
              </span>
              {datos.esObligatorio && (
                <Chip tono="marca" icono={CircleDot}>
                  Obligatorio
                </Chip>
              )}
              {datos.fechaLimite && (
                <Chip icono={CalendarClock}>
                  <span className="cifras-tabulares">Vence {fechaDia(datos.fechaLimite)}</span>
                </Chip>
              )}
            </div>
            {datos.descripcion && <p className={styles.descripcion}>{datos.descripcion}</p>}
          </header>
        )}

        {temas.estado === 'error' && !visibles && (
          <div className={pagina.errorCarga}>
            <Alerta>{temas.error.message}</Alerta>
            <Button variante="secundario" icono={RotateCw} onClick={temas.recargar}>
              Reintentar
            </Button>
          </div>
        )}

        {!visibles && temas.estado === 'cargando' && (
          <div className={styles.cargandoVisor} aria-busy="true" aria-label="Cargando temas">
            <Skeleton alto={320} />
            <Skeleton alto={420} />
          </div>
        )}

        {visibles && visibles.length === 0 && (
          <EstadoVacio
            icono={EyeOff}
            titulo="Este curso todavía no tiene contenido visible"
            accion={
              <Link to={editor} className={styles.enlaceEditor}>
                Volver al editor
              </Link>
            }
          >
            <p>Agrega temas y materiales, o muestra los que están ocultos, para que el empleado los vea.</p>
          </EstadoVacio>
        )}

        {visibles && visibles.length > 0 && <VisorCurso temas={visibles} />}
      </main>
    </div>
  );
}
