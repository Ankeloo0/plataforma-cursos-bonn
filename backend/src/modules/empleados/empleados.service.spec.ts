import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { UsuarioSesion } from '../../common/interfaces/usuario-sesion.interface.js';
import type { CatalogoService } from '../catalogo/catalogo.service.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import type { UsuariosService } from '../usuarios/usuarios.service.js';
import type { EmpleadosRepository } from './empleados.repository.js';
import { EmpleadosService } from './empleados.service.js';
import type { Empleado } from './entities/empleado.entity.js';

const adminA: UsuarioSesion = {
  id: 'a1',
  rol: 'ADMIN',
  debeCambiarPassword: false,
  permisos: [],
  alcance: { sinLimite: false, sucursalIds: ['A'] },
  sucursalId: null,
};

const datosAlta = {
  sucursalId: 'A',
  puestoId: 'p1',
  nombres: 'Ana',
  apellidoPaterno: 'Ruiz',
  numeroEmpleado: '1024',
  fechaIngreso: '2026-03-01',
  passwordTemporal: 'Temporal2026',
};

function crear(empleado: Partial<Empleado> | null = { id: 'e1', usuarioId: 'u1', empresaId: 'E1', puestoId: 'p1' }) {
  const manager = {};
  const repo = {
    crear: vi.fn().mockResolvedValue({ id: 'e1' }),
    guardar: vi.fn(),
    buscarEnAlcance: vi.fn().mockResolvedValue(empleado),
    buscarDetalle: vi.fn().mockResolvedValue(null),
    listar: vi.fn(),
  };
  const usuarios = {
    crear: vi.fn().mockResolvedValue({ id: 'u1' }),
    guardar: vi.fn(),
    obtenerGestionable: vi.fn().mockResolvedValue({ id: 'u1', sucursalId: 'A' } as Usuario),
  };
  const alcance = { exigirSucursal: vi.fn().mockResolvedValue({ id: 'A', empresaId: 'E1' }) };
  const catalogo = { exigirPuestoActivo: vi.fn().mockResolvedValue({ id: 'p1' }) };
  const dataSource = { transaction: vi.fn((trabajo: (m: object) => Promise<unknown>) => trabajo(manager)) };
  const servicio = new EmpleadosService(
    repo as unknown as EmpleadosRepository,
    usuarios as unknown as UsuariosService,
    alcance as unknown as AlcanceService,
    catalogo as unknown as CatalogoService,
    dataSource as unknown as DataSource,
  );
  vi.spyOn(servicio, 'obtener').mockResolvedValue({} as never);
  return { servicio, repo, usuarios, alcance, catalogo, manager };
}

describe('EmpleadosService', () => {
  describe('crear (RF-03.1)', () => {
    it('crea la cuenta sin usuario y el empleado en la misma transacción, con la empresa de su sucursal (D-34)', async () => {
      const { servicio, repo, usuarios, manager } = crear();
      await servicio.crear(datosAlta, adminA);

      expect(usuarios.crear).toHaveBeenCalledWith(
        expect.objectContaining({ rol: 'EMPLEADO', sucursalId: 'A', passwordTemporal: 'Temporal2026' }),
        'a1',
        manager,
      );
      expect(usuarios.crear.mock.calls[0][0]).not.toHaveProperty('username');
      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: 'u1', empresaId: 'E1', numeroEmpleado: '1024', creadoPor: 'a1' }),
        manager,
      );
    });

    it('valida la sucursal en el alcance y el puesto antes de escribir', async () => {
      const { servicio, alcance, usuarios } = crear();
      alcance.exigirSucursal.mockRejectedValue(new NotFoundException());
      await expect(servicio.crear(datosAlta, adminA)).rejects.toThrow(NotFoundException);
      expect(alcance.exigirSucursal).toHaveBeenCalledWith(adminA.alcance, 'A');
      expect(usuarios.crear).not.toHaveBeenCalled();
    });
  });

  describe('actualizar (RF-03.3)', () => {
    it('responde 404 si el empleado no está en el alcance', async () => {
      const { servicio } = crear(null);
      await expect(servicio.actualizar('x', { nombres: 'Luis' }, adminA)).rejects.toThrow(NotFoundException);
    });

    it('no traslada a una sucursal de otra empresa (V-03)', async () => {
      const { servicio, alcance, repo } = crear();
      alcance.exigirSucursal.mockResolvedValue({ id: 'B', empresaId: 'E2' });
      const error = await servicio.actualizar('e1', { sucursalId: 'B' }, adminA).catch((e: UnprocessableEntityException) => e);
      expect((error as UnprocessableEntityException).getResponse()).toMatchObject({ code: 'TRASLADO_OTRA_EMPRESA' });
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it('traslada dentro de la empresa, cambia el puesto y marca la auditoría de las dos tablas', async () => {
      const { servicio, alcance, catalogo, usuarios, repo } = crear();
      alcance.exigirSucursal.mockResolvedValue({ id: 'A2', empresaId: 'E1' });

      await servicio.actualizar('e1', { sucursalId: 'A2', puestoId: 'p2', numeroEmpleado: 'A-9' }, adminA);

      expect(catalogo.exigirPuestoActivo).toHaveBeenCalledWith('p2');
      expect(usuarios.guardar).toHaveBeenCalledWith(expect.objectContaining({ sucursalId: 'A2', actualizadoPor: 'a1' }), expect.anything());
      expect(repo.guardar).toHaveBeenCalledWith(
        expect.objectContaining({ puestoId: 'p2', numeroEmpleado: 'A-9', empresaId: 'E1', actualizadoPor: 'a1' }),
        expect.anything(),
      );
    });
  });

  it('a un administrador sin sucursales le devuelve una lista vacía sin consultar', async () => {
    const { servicio, repo } = crear();
    const sinAlcance = { ...adminA, alcance: { sinLimite: false, sucursalIds: [] } };
    const respuesta = await servicio.listar({ page: 1, limit: 20, offset: 0 } as never, sinAlcance);
    expect(respuesta.meta.total).toBe(0);
    expect(repo.listar).not.toHaveBeenCalled();
  });
});
