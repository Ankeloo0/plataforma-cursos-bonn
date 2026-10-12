import { duracionDelArticuloSegundos, limpiarArticulo, palabrasDelArticulo } from './articulo.js';

describe('articulo', () => {
  it('conserva el formato que permite el editor', () => {
    const html =
      '<h2>Recepción</h2><h3>Pasos</h3><p>Texto con <strong>negrita</strong>, <em>cursiva</em><br />y salto.</p>' +
      '<ul><li>Uno</li></ul><ol><li>Dos</li></ol><blockquote><p>Cita</p></blockquote>';

    expect(limpiarArticulo(html)).toBe(html);
  });

  it('quita los scripts con su contenido y los atributos peligrosos', () => {
    const limpio = limpiarArticulo('<p onclick="robar()">Hola</p><script>alert(1)</script><img src=x onerror="robar()">');

    expect(limpio).toBe('<p>Hola</p>');
  });

  it('quita las etiquetas fuera de la lista y conserva su texto', () => {
    expect(limpiarArticulo('<h1>Titulo</h1><table><tr><td>Celda</td></tr></table><pre><code>x = 1</code></pre>')).toBe(
      'TituloCeldax = 1',
    );
  });

  it('solo acepta enlaces http y https, y los abre en otra pestana sin dar acceso a la pagina', () => {
    expect(limpiarArticulo('<a href="https://vw.com" class="x">VW</a>')).toBe(
      '<a href="https://vw.com" target="_blank" rel="noopener noreferrer">VW</a>',
    );
    expect(limpiarArticulo('<a href="javascript:robar()">Clic</a>')).toBe('<a target="_blank" rel="noopener noreferrer">Clic</a>');
  });

  it('cuenta las palabras sin juntar las de dos parrafos', () => {
    expect(palabrasDelArticulo('<p>Hola mundo</p><p>otra&nbsp;vez</p>')).toBe(4);
    expect(palabrasDelArticulo('<p></p><p> </p>')).toBe(0);
  });

  it('suma 1 minuto por cada 240 palabras, redondeado hacia arriba (D-36)', () => {
    expect(duracionDelArticuloSegundos(1)).toBe(60);
    expect(duracionDelArticuloSegundos(240)).toBe(60);
    expect(duracionDelArticuloSegundos(241)).toBe(120);
  });
});
