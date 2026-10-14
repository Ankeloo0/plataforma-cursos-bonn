import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { Tema } from '../types/contenido.types';
import { detalleMaterial } from '../utils/material';
import { VisorMaterial } from './VisorMaterial';
import styles from './VisorCurso.module.css';

interface Posicion {
  tema: number;
  material: number;
}

//temas a la izquierda y el material elegido a la derecha; recibe solo lo visible.
//sin avance ni candados: todos los temas estan abiertos
export function VisorCurso({ temas }: { temas: Tema[] }) {
  const [posicion, setPosicion] = useState<Posicion>({ tema: 0, material: 0 });
  //temas desplegados en la lista; empieza con el primero
  const [desplegados, setDesplegados] = useState<number[]>([0]);
  const tema = temas[posicion.tema];
  const material = tema.materiales[posicion.material];

  //anterior y siguiente recorren todos los materiales del curso en orden
  const recorrido = temas.flatMap((t, i) => t.materiales.map((_, j) => ({ tema: i, material: j })));
  const actual = recorrido.findIndex((p) => p.tema === posicion.tema && p.material === posicion.material);
  const anterior = actual > 0 ? recorrido[actual - 1] : null;
  const siguiente = actual >= 0 && actual < recorrido.length - 1 ? recorrido[actual + 1] : null;

  function alternar(i: number) {
    setDesplegados((lista) => (lista.includes(i) ? lista.filter((t) => t !== i) : [...lista, i]));
  }

  //al llegar a un tema con anterior o siguiente, su lista se despliega
  function irA(destino: Posicion) {
    setPosicion(destino);
    setDesplegados((lista) => (lista.includes(destino.tema) ? lista : [...lista, destino.tema]));
  }

  return (
    <div className={styles.visor}>
      <nav className={styles.temas} aria-label="Temas del curso">
        <h2 className={styles.tituloLista}>Temas</h2>
        <ol className={styles.lista}>
          {temas.map((t, i) => (
            <li key={t.id} className={styles.seccion}>
              <button
                type="button"
                className={styles.tema}
                aria-current={i === posicion.tema ? 'step' : undefined}
                aria-expanded={desplegados.includes(i)}
                aria-controls={`visor-materiales-${i}`}
                onClick={() => alternar(i)}
              >
                <span className={styles.temaTexto}>
                  <span>
                    <span className="cifras-tabulares">{i + 1}.</span> {t.titulo}
                  </span>
                  <span className={`${styles.temaCuenta} cifras-tabulares`}>
                    {t.materiales.length === 1 ? '1 material' : `${t.materiales.length} materiales`}
                  </span>
                </span>
                <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" className={styles.flecha} />
              </button>
              {desplegados.includes(i) && t.materiales.length > 0 && (
                <ol id={`visor-materiales-${i}`} className={styles.materiales} aria-label={`Materiales del tema ${i + 1}`}>
                  {t.materiales.map((m, j) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={styles.material}
                        aria-current={i === posicion.tema && j === posicion.material ? 'true' : undefined}
                        onClick={() => setPosicion({ tema: i, material: j })}
                      >
                        <span className={`${styles.numeroMaterial} cifras-tabulares`}>
                          {i + 1}.{j + 1}
                        </span>{' '}
                        <span>{m.titulo}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <section className={styles.contenido} aria-labelledby="visor-tema">
        <h2 id="visor-tema" className={styles.tituloTema}>
          Tema {posicion.tema + 1} · {tema.titulo}
        </h2>

        {!material ? (
          <p className={styles.sinMateriales}>Este tema no tiene materiales visibles.</p>
        ) : (
          <>
            <h3 className={styles.tituloMaterial}>
              <span className="cifras-tabulares">
                {posicion.tema + 1}.{posicion.material + 1}
              </span>{' '}
              {material.titulo}
            </h3>
            <VisorMaterial material={material} />
            <p className={`${styles.detalle} cifras-tabulares`}>
              Material {posicion.material + 1} de {tema.materiales.length} · {detalleMaterial(material)}
            </p>
            {material.descripcion && <p className={styles.descripcion}>{material.descripcion}</p>}
          </>
        )}

        <div className={styles.navegacion}>
          {anterior && (
            <Button variante="secundario" icono={ArrowLeft} onClick={() => irA(anterior)}>
              Material anterior
            </Button>
          )}
          {siguiente && (
            <Button variante="secundario" onClick={() => irA(siguiente)} className={styles.siguiente}>
              Siguiente material
              <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
