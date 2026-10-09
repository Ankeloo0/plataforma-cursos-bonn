import { readFile } from 'node:fs/promises';
import path from 'node:path';

const carpeta = path.join(import.meta.dirname);

// MP4 H.264 de 160 x 90 y 3 segundos, generado con FFmpeg (testsrc)
export const videoDePrueba = () => readFile(path.join(carpeta, 'video-3s.mp4'));

// DOCX minimo: un parrafo "Documento de prueba"
export const documentoDePrueba = () => readFile(path.join(carpeta, 'documento.docx'));

// PDF de una pagina con el texto indicado (solo letras ASCII), con su tabla xref correcta
export function pdfConTexto(texto: string): Buffer {
  const flujo = `BT /F1 18 Tf 72 720 Td (${texto}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones: number[] = [];
  objetos.forEach((objeto, i) => {
    posiciones.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
