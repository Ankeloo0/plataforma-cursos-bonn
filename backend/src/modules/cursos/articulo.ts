import sanitizeHtml from 'sanitize-html';

export const ARTICULO_MAXIMO_CARACTERES = 100_000;
export const PAGINA_MAXIMO_IMAGENES = 30;
const PALABRAS_POR_MINUTO = 240;

//solo imagenes subidas a la plataforma: nunca una direccion externa
const SRC_IMAGEN = /^\/api\/v1\/archivos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/contenido$/;

// Lista permitida de technical-spec 4.8: lo que produce el editor y nada mas.
// script y style se eliminan con su contenido; las demas etiquetas se quitan y conservan su texto.
const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'a', 'img'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'] },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
  exclusiveFilter: (frame) => frame.tag === 'img' && !SRC_IMAGEN.test(frame.attribs.src ?? ''),
};

// El HTML del editor no es confiable: se limpia antes de guardarlo para poder mostrarlo sin riesgo
export function limpiarArticulo(html: string): string {
  return sanitizeHtml(html, OPCIONES).trim();
}

// Ids de los archivos de las imagenes de una pagina ya limpia, sin repetir
export function imagenesDelArticulo(html: string): string[] {
  const ids = [...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => SRC_IMAGEN.exec(m[1])?.[1]);
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

// Las etiquetas se cambian por espacios para no juntar las palabras de dos parrafos
export function palabrasDelArticulo(html: string): number {
  const texto = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');
  return texto.split(/\s+/).filter(Boolean).length;
}

// D-36: 1 minuto por cada 240 palabras, redondeado hacia arriba
export function duracionDelArticuloSegundos(palabras: number): number {
  return Math.ceil(palabras / PALABRAS_POR_MINUTO) * 60;
}
