import { CalendarClock, CircleDot, Clock, Pencil } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { fechaDia } from '../../../utils/formato';
import type { Curso } from '../types/cursos.types';
import { duracion, ESTADO_CURSO } from '../utils/curso';
import { PortadaCurso } from './PortadaCurso';
import styles from './TarjetaCurso.module.css';

// Tarjeta del catalogo del administrador (design-reference 8.3): portada, obligatorio y fecha limite,
// titulo, duracion y estado, y la accion Editar si puede editarlo.
export function TarjetaCurso({ curso, alEditar }: { curso: Curso; alEditar: () => void }) {
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
            {curso.duracionHoras > 0 ? <span className="cifras-tabulares">{duracion(curso.duracionHoras)}</span> : 'Sin videos'}
          </span>
          <Chip tono={estado.tono} icono={estado.icono}>
            {estado.etiqueta}
          </Chip>
        </div>
      </div>
      <div className={styles.pie}>
        <span className={`${styles.secundario} cifras-tabulares`}>Aprueba con {curso.calificacionMinima}</span>
        {curso.puedeEditar ? (
          <Button variante="texto" icono={Pencil} onClick={alEditar} aria-label={`Editar ${curso.titulo}`}>
            Editar
          </Button>
        ) : (
          <span className={styles.secundario}>Solo consulta</span>
        )}
      </div>
    </article>
  );
}
