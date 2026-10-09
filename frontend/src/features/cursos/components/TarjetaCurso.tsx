import { CalendarClock, CircleDot, Clock, ListTree } from 'lucide-react';
import { Link } from 'react-router';
import { Chip } from '../../../components/ui/Chip';
import { fechaDia } from '../../../utils/formato';
import type { Curso } from '../types/cursos.types';
import { duracion, ESTADO_CURSO } from '../utils/curso';
import { PortadaCurso } from './PortadaCurso';
import styles from './TarjetaCurso.module.css';

// Tarjeta del catalogo del administrador (design-reference 8.3): portada, obligatorio y fecha limite,
// titulo, duracion y estado. Abre el editor de contenido, o su consulta si no lo puede editar.
export function TarjetaCurso({ curso }: { curso: Curso }) {
  const estado = ESTADO_CURSO[curso.estado];

  return (
    <article className={styles.tarjeta}>
      <div className={styles.cabecera}>
        <PortadaCurso src={curso.portadaUrl} titulo={curso.titulo} />
        {(curso.esObligatorio || curso.fechaLimite) && (
          <div className={styles.chips}>
            {curso.esObligatorio && (
              <Chip tono="marca" icono={CircleDot}>
                Obligatorio
              </Chip>
            )}
            {curso.fechaLimite && (
              <Chip icono={CalendarClock}>
                <span className="cifras-tabulares">Vence {fechaDia(curso.fechaLimite)}</span>
              </Chip>
            )}
          </div>
        )}
      </div>
      <div className={styles.cuerpo}>
        <h2 className={styles.titulo}>{curso.titulo}</h2>
        <div className={styles.datos}>
          <span className={styles.dato}>
            <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
            {curso.duracionHoras > 0 ? <span className="cifras-tabulares">{duracion(curso.duracionHoras)}</span> : 'Sin duración'}
          </span>
          <Chip tono={estado.tono} icono={estado.icono}>
            {estado.etiqueta}
          </Chip>
        </div>
      </div>
      <div className={styles.pie}>
        <span className={`${styles.secundario} cifras-tabulares`}>Aprueba con {curso.calificacionMinima}</span>
        <Link
          to={`/cursos/${curso.id}/editar`}
          className={styles.enlace}
          aria-label={`${curso.puedeEditar ? 'Editar contenido de' : 'Ver contenido de'} ${curso.titulo}`}
        >
          <ListTree size={20} strokeWidth={1.75} aria-hidden="true" />
          {curso.puedeEditar ? 'Editar contenido' : 'Ver contenido'}
        </Link>
      </div>
    </article>
  );
}
