const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "30 sep 2026" en la hora local de Mexico (design-reference 6.2)
export function fecha(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// Fecha sin hora de la API ("2026-03-01"): se arma con sus partes, porque new Date() la tomaria
// como medianoche UTC y en Mexico mostraria el dia anterior
export function fechaDia(texto: string): string {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

export function hora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "30 sep 2026, 14:05"
export function fechaHora(iso: string): string {
  return `${fecha(iso)}, ${hora(iso)}`;
}
