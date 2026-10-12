import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  CircleAlert,
  Heading2,
  Heading3,
  Italic,
  Link as IconoEnlace,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { contarPalabras, resumenLectura } from '../utils/material';
import styles from './EditorArticulo.module.css';

export interface PropsEditorArticulo {
  valorInicial: string;
  // HTML vacio ('') si el articulo no tiene texto
  alCambiar: (html: string) => void;
  error?: string;
}

// Solo el formato de RF-04.4: parrafos, dos niveles de subtitulo, negrita, cursiva, listas, enlaces y citas.
// Lo que no esta aqui (tablas, codigo, imagenes) se pierde al pegar. La API vuelve a limpiar el HTML.
const EXTENSIONES = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
];

const DIRECCION_VALIDA = /^https?:\/\/\S+$/i;

// Con un espacio entre bloques, para no juntar la ultima palabra de un parrafo con la primera del siguiente
const palabrasDe = (editor: Editor) => contarPalabras(editor.getText({ blockSeparator: ' ' }));

interface Formato {
  etiqueta: string;
  icono: LucideIcon;
  activo: (editor: Editor) => boolean;
  aplicar: (editor: Editor) => void;
}

const FORMATOS: Formato[][] = [
  [
    {
      etiqueta: 'Párrafo',
      icono: Pilcrow,
      activo: (e) => e.isActive('paragraph') && !e.isActive('blockquote') && !e.isActive('listItem'),
      aplicar: (e) => e.chain().focus().setParagraph().run(),
    },
    {
      etiqueta: 'Subtítulo 1',
      icono: Heading2,
      activo: (e) => e.isActive('heading', { level: 2 }),
      aplicar: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      etiqueta: 'Subtítulo 2',
      icono: Heading3,
      activo: (e) => e.isActive('heading', { level: 3 }),
      aplicar: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ],
  [
    { etiqueta: 'Negrita', icono: Bold, activo: (e) => e.isActive('bold'), aplicar: (e) => e.chain().focus().toggleBold().run() },
    { etiqueta: 'Cursiva', icono: Italic, activo: (e) => e.isActive('italic'), aplicar: (e) => e.chain().focus().toggleItalic().run() },
  ],
  [
    {
      etiqueta: 'Lista con viñetas',
      icono: List,
      activo: (e) => e.isActive('bulletList'),
      aplicar: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      etiqueta: 'Lista numerada',
      icono: ListOrdered,
      activo: (e) => e.isActive('orderedList'),
      aplicar: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    { etiqueta: 'Cita', icono: Quote, activo: (e) => e.isActive('blockquote'), aplicar: (e) => e.chain().focus().toggleBlockquote().run() },
  ],
];

// Editor de articulos (RF-04.4, D-37) con TipTap. data-panel-amplio ensancha el panel lateral a 720 px.
export function EditorArticulo({ valorInicial, alCambiar, error }: PropsEditorArticulo) {
  const idEtiqueta = useId();
  const idError = useId();
  const [enlace, setEnlace] = useState<{ direccion: string; error?: string } | null>(null);

  const editor = useEditor({
    extensions: EXTENSIONES,
    content: valorInicial,
    // Vuelve a dibujar con cada cambio para que la barra marque el formato donde esta el cursor
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: styles.area,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': idEtiqueta,
      },
    },
    onUpdate: ({ editor: e }) => alCambiar(palabrasDe(e) === 0 ? '' : e.getHTML()),
  });
  const palabras = palabrasDe(editor);

  function abrirEnlace() {
    setEnlace({ direccion: (editor.getAttributes('link').href as string | undefined) ?? 'https://' });
  }

  function aplicarEnlace() {
    if (!enlace) return;
    const direccion = enlace.direccion.trim();
    if (!DIRECCION_VALIDA.test(direccion)) {
      setEnlace({ direccion, error: 'Escribe una dirección completa que empiece con http:// o https://.' });
      return;
    }
    const cadena = editor.chain().focus().extendMarkRange('link');
    // Sin texto seleccionado, la direccion se escribe como texto del enlace
    if (editor.state.selection.empty && !editor.isActive('link')) {
      cadena.insertContent({ type: 'text', text: direccion, marks: [{ type: 'link', attrs: { href: direccion } }] }).run();
    } else {
      cadena.setLink({ href: direccion }).run();
    }
    setEnlace(null);
  }

  function quitarEnlace() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setEnlace(null);
  }

  // Enter no debe enviar el formulario del material
  function teclaEnlace(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      aplicarEnlace();
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      setEnlace(null);
    }
  }

  return (
    <div className={styles.campo} data-panel-amplio>
      <span id={idEtiqueta} className={styles.etiqueta}>
        Contenido<span aria-hidden="true"> *</span>
      </span>

      <div className={styles.marco} aria-invalid={error ? true : undefined}>
        <div className={styles.barra} role="toolbar" aria-label="Formato del artículo">
          {FORMATOS.map((grupo, indice) => (
            <div key={indice} className={styles.grupo}>
              {grupo.map(({ etiqueta, icono: Icono, activo, aplicar }) => (
                <button
                  key={etiqueta}
                  type="button"
                  className={styles.boton}
                  aria-label={etiqueta}
                  title={etiqueta}
                  aria-pressed={activo(editor)}
                  onClick={() => aplicar(editor)}
                >
                  <Icono size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              ))}
            </div>
          ))}
          <div className={styles.grupo}>
            <button
              type="button"
              className={styles.boton}
              aria-label="Enlace"
              title="Enlace"
              aria-pressed={editor.isActive('link')}
              aria-expanded={enlace !== null}
              onClick={abrirEnlace}
            >
              <IconoEnlace size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        {enlace && (
          <div className={styles.enlace}>
            <Input
              etiqueta="Dirección del enlace"
              type="url"
              inputMode="url"
              autoComplete="off"
              autoFocus
              value={enlace.direccion}
              error={enlace.error}
              onChange={(evento) => setEnlace({ direccion: evento.target.value })}
              onKeyDown={teclaEnlace}
            />
            <div className={styles.accionesEnlace}>
              <Button tamano="compacto" onClick={aplicarEnlace}>
                Aplicar
              </Button>
              {editor.isActive('link') && (
                <Button tamano="compacto" variante="secundario" onClick={quitarEnlace}>
                  Quitar enlace
                </Button>
              )}
              <Button tamano="compacto" variante="texto" onClick={() => setEnlace(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <EditorContent editor={editor} />

        <p className={styles.resumen} aria-live="polite">
          {resumenLectura(palabras)}
        </p>
      </div>

      <div aria-live="polite">
        {error && (
          <p id={idError} className={styles.error}>
            <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}
