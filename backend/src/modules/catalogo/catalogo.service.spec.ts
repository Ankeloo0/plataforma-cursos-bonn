import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import type { CatalogoRepository } from './catalogo.repository.js';
import { CatalogoService } from './catalogo.service.js';
import type { Area } from './entities/area.entity.js';
import type { Puesto } from './entities/puesto.entity.js';

const area = (datos: Partial<Area> = {}) => ({ id: 'a1', nombre: 'Servicio', activo: true, ...datos }) as Area;
const puesto = (datos: Partial<Puesto> = {}) => ({ id: 'p1', areaId: 'a1', nombre: 'Asesor', activo: true, ...datos }) as Puesto;

function crear(datos: { area?: Area | null; puesto?: Puesto | null; puestosActivos?: number; empleadosActivos?: number } = {}) {
  const repo = {
    buscarArea: vi.fn().mockResolvedValue(datos.area === undefined ? area() : datos.area),
    buscarPuesto: vi.fn().mockResolvedValue(datos.puesto === undefined ? puesto() : datos.puesto),
    contarPuestosActivos: vi.fn().mockResolvedValue(datos.puestosActivos ?? 0),
    contarEmpleadosActivosDePuesto: vi.fn().mockResolvedValue(datos.empleadosActivos ?? 0),
    guardarArea: vi.fn(),
    guardarPuesto: vi.fn(),
    crearPuesto: vi.fn().mockResolvedValue(puesto()),
    buscarAreaConUso: vi.fn(),
    buscarPuestoConUso: vi.fn(),
  };
  const servicio = new CatalogoService(repo as unknown as CatalogoRepository);
  // La respuesta final no importa en estas pruebas: solo las reglas
  vi.spyOn(servicio, 'obtenerArea').mockResolvedValue({} as never);
  vi.spyOn(servicio, 'obtenerPuesto').mockResolvedValue({} as never);
  return { servicio, repo };
}

describe('CatalogoService', () => {
  it('no desactiva un área con puestos activos (RN-02.4)', async () => {
    const { servicio, repo } = crear({ puestosActivos: 2 });
    await expect(servicio.cambiarEstadoArea('a1', false, 's1')).rejects.toThrow(ConflictException);
    expect(repo.guardarArea).not.toHaveBeenCalled();
  });

  it('desactiva un área sin puestos activos y registra quién lo hizo', async () => {
    const { servicio, repo } = crear();
    await servicio.cambiarEstadoArea('a1', false, 's1');
    expect(repo.guardarArea).toHaveBeenCalledWith(expect.objectContaining({ activo: false, actualizadoPor: 's1' }));
  });

  it('no desactiva un puesto con empleados activos (RN-02.3)', async () => {
    const { servicio, repo } = crear({ empleadosActivos: 1 });
    await expect(servicio.cambiarEstadoPuesto('p1', false, 's1')).rejects.toThrow(ConflictException);
    expect(repo.guardarPuesto).not.toHaveBeenCalled();
  });

  it('no activa un puesto ni crea uno en un área inactiva', async () => {
    const inactiva = crear({ area: area({ activo: false }), puesto: puesto({ activo: false }) });
    await expect(inactiva.servicio.cambiarEstadoPuesto('p1', true, 's1')).rejects.toThrow(UnprocessableEntityException);
    await expect(inactiva.servicio.crearPuesto({ areaId: 'a1', nombre: 'Cajero' }, 's1')).rejects.toThrow(UnprocessableEntityException);
    expect(inactiva.repo.crearPuesto).not.toHaveBeenCalled();
  });

  it('exigirPuestoActivo distingue un puesto inexistente de uno desactivado', async () => {
    const noExiste = await crear({ puesto: null }).servicio.exigirPuestoActivo('x').catch((e: UnprocessableEntityException) => e);
    const inactivo = await crear({ puesto: puesto({ activo: false }) }).servicio.exigirPuestoActivo('p1').catch((e: UnprocessableEntityException) => e);
    expect((noExiste as UnprocessableEntityException).getResponse()).toMatchObject({ code: 'PUESTO_NO_ENCONTRADO' });
    expect((inactivo as UnprocessableEntityException).getResponse()).toMatchObject({ code: 'PUESTO_INACTIVO' });
    await expect(crear().servicio.exigirPuestoActivo('p1')).resolves.toMatchObject({ id: 'p1' });
  });
});
