import { fecha, fechaDia, fechaHora } from './formato';

describe('formato', () => {
  it('da fechas en el formato de la plataforma', () => {
    expect(fecha('2026-09-30T20:05:00')).toBe('30 sep 2026');
    expect(fechaHora('2026-01-02T09:07:00')).toBe('2 ene 2026, 09:07');
  });

  it('una fecha sin hora no se recorre un día por la zona horaria', () => {
    expect(fechaDia('2026-03-01')).toBe('1 mar 2026');
  });
});
