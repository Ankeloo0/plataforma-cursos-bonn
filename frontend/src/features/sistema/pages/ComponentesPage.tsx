import {
  BadgeCheck,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { LogoPlataforma } from '../../../components/ui/LogoPlataforma';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { Input } from '../../../components/ui/Input';
import styles from './ComponentesPage.module.css';

// Catalogo de los componentes base con todos sus estados (Iteracion 0, T0.5).
// Solo existe en desarrollo: sirve para revisar la identidad de la plataforma antes de construir pantallas.
export function ComponentesPage() {
  const [guardando, setGuardando] = useState(false);
  const [numero, setNumero] = useState('10234');

  function simularGuardado() {
    setGuardando(true);
    setTimeout(() => setGuardando(false), 2000);
  }

  return (
    <main className={styles.pagina}>
      <header className={styles.encabezado}>
        <LogoPlataforma alto={48} className={styles.logo} />
        <h1 className="titulo-pagina">Componentes base</h1>
        <p className={styles.bajada}>
          Botones, campos, fotos de perfil y chips de estado con la identidad de la plataforma. Pasa el cursor, usa el
          teclado (Tab) y prueba cada estado.
        </p>
      </header>

      <Seccion titulo="Botones" referencia="§8.1">
        <Fila etiqueta="Variantes">
          <Button icono={Plus}>Nuevo empleado</Button>
          <Button variante="secundario">Vista previa</Button>
          <Button variante="texto">Ver curso</Button>
          <Button variante="peligro" icono={Trash2}>
            Archivar curso
          </Button>
        </Fila>
        <Fila etiqueta="Tamaños">
          <Button tamano="compacto">Compacto · 32 px</Button>
          <Button>Normal · 40 px</Button>
          <Button tamano="grande">Grande · 48 px</Button>
        </Fila>
        <Fila etiqueta="Cargando">
          <Button icono={Save} cargando={guardando} textoCargando="Guardando…" onClick={simularGuardado}>
            Guardar
          </Button>
          <Button variante="secundario" cargando textoCargando="Generando…">
            Generar reporte
          </Button>
        </Fila>
        <Fila etiqueta="Deshabilitados">
          <Button disabled motivoDeshabilitado="Completa todos los temas para presentar la evaluación final">
            Presentar evaluación
          </Button>
          <Button variante="secundario" disabled>
            Cancelar
          </Button>
          <Button variante="texto" disabled>
            Ver certificado
          </Button>
        </Fila>
      </Seccion>

      <Seccion titulo="Campos de formulario" referencia="§8.2">
        <p className={styles.nota}>Los campos marcados con * son obligatorios.</p>
        <div className={styles.rejillaCampos}>
          <Input
            etiqueta="Número de empleado"
            required
            ayuda="Único dentro de la empresa."
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
          <Input etiqueta="Usuario" placeholder="p. ej. jperez" required />
          <Input
            etiqueta="Número de empleado"
            required
            defaultValue="10234"
            error="Ese número ya existe en esta empresa. Revisa si el empleado ya fue dado de alta."
          />
          <Input etiqueta="Apellido materno" placeholder="p. ej. Ramírez" />
          <Input etiqueta="Sucursal" defaultValue="Volkswagen Bonn Oaxaca" readOnly ayuda="Se asigna desde tu sesión." />
          <Input etiqueta="Fecha de ingreso" type="date" disabled />
        </div>
      </Seccion>

      <Seccion titulo="Foto de perfil" referencia="§8.5">
        <Fila etiqueta="Tamaños">
          <Avatar id="u-1" nombres="Ana" apellidoPaterno="López" tamano={24} />
          <Avatar id="u-1" nombres="Ana" apellidoPaterno="López" tamano={32} />
          <Avatar id="u-1" nombres="Ana" apellidoPaterno="López" tamano={40} />
          <Avatar id="u-1" nombres="Ana" apellidoPaterno="López" tamano={96} />
        </Fila>
        <Fila etiqueta="Color estable por persona">
          {PERSONAS.map((p) => (
            <Avatar key={p.id} {...p} tamano={40} />
          ))}
        </Fila>
        <Fila etiqueta="Superpuestas · foto que no carga">
          <span className={styles.pila}>
            {PERSONAS.slice(0, 4).map((p) => (
              <Avatar key={p.id} {...p} tamano={32} superpuesto />
            ))}
          </span>
          <Avatar id="u-9" nombres="Foto" apellidoPaterno="Rota" src="/no-existe.jpg" tamano={40} />
        </Fila>
      </Seccion>

      <Seccion titulo="Chips de estado" referencia="§4.3 y §8.5">
        <Fila etiqueta="Estados del curso">
          <Chip tono="neutro" icono={Circle}>
            Sin iniciar
          </Chip>
          <Chip tono="info" icono={CircleDashed}>
            En proceso · 45 %
          </Chip>
          <Chip tono="exito" icono={CircleCheck}>
            Completado
          </Chip>
          <Chip tono="critico" icono={CircleAlert}>
            Vencido
          </Chip>
        </Fila>
        <Fila etiqueta="Avisos y atributos">
          <Chip tono="aviso" icono={Clock}>
            Vence en 5 días
          </Chip>
          <Chip tono="marca" icono={BadgeCheck}>
            Obligatorio
          </Chip>
        </Fila>
      </Seccion>
    </main>
  );
}

const PERSONAS = [
  { id: 'a3f1', nombres: 'Ana', apellidoPaterno: 'López' },
  { id: 'b7c2', nombres: 'Jorge', apellidoPaterno: 'Pérez' },
  { id: 'c9d4', nombres: 'Lucía', apellidoPaterno: 'Martínez' },
  { id: 'd2e8', nombres: 'Ñeli', apellidoPaterno: 'Ávila' },
  { id: 'e5f6', nombres: 'Raúl', apellidoPaterno: 'Hernández' },
];

function Seccion({ titulo, referencia, children }: { titulo: string; referencia: string; children: ReactNode }) {
  return (
    <section className={styles.seccion} aria-labelledby={`seccion-${titulo}`}>
      <h2 id={`seccion-${titulo}`} className={styles.tituloSeccion}>
        {titulo} <span className={styles.referencia}>design-reference {referencia}</span>
      </h2>
      {children}
    </section>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className={styles.fila}>
      <p className={styles.etiquetaFila}>{etiqueta}</p>
      <div className={styles.contenidoFila}>{children}</div>
    </div>
  );
}
