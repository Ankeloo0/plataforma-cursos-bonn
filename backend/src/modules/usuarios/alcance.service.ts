import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { TODOS_LOS_PERMISOS, type Permiso } from '../../common/constants/permisos.js';
import { ROLES, type Rol } from '../../common/constants/roles.js';
import type { Alcance } from '../../common/interfaces/usuario-sesion.interface.js';
import { AlcanceRepository, type SucursalDeAlcance } from './alcance.repository.js';

const SIN_ALCANCE: Alcance = { sinLimite: false, sucursalIds: [] };

@Injectable()
export class AlcanceService {
  constructor(private readonly alcanceRepository: AlcanceRepository) {}

  // Se llama en cada peticion: quitar un permiso o una sucursal tiene efecto inmediato (RN-00.10, T-22)
  async cargar(usuario: { id: string; rol: Rol }): Promise<{ permisos: Permiso[]; alcance: Alcance }> {
    if (usuario.rol === ROLES.SUPERUSUARIO) {
      return { permisos: TODOS_LOS_PERMISOS, alcance: { sinLimite: true, sucursalIds: [] } };
    }
    if (usuario.rol !== ROLES.ADMIN) return { permisos: [], alcance: SIN_ALCANCE };

    const [permisos, sucursalIds] = await Promise.all([
      this.alcanceRepository.permisosDe(usuario.id),
      this.alcanceRepository.sucursalesOperablesDe(usuario.id),
    ]);
    return { permisos, alcance: { sinLimite: false, sucursalIds } };
  }

  permisosDe(usuarioId: string): Promise<Permiso[]> {
    return this.alcanceRepository.permisosDe(usuarioId);
  }

  sucursalesDe(usuarioId: string): Promise<SucursalDeAlcance[]> {
    return this.alcanceRepository.sucursalesDe(usuarioId);
  }

  async reemplazarAcceso(usuarioId: string, permisos: Permiso[], sucursalIds: string[], actorId: string): Promise<void> {
    const unicas = [...new Set(sucursalIds)];
    const existentes = await this.alcanceRepository.idsDeSucursalesExistentes(unicas);
    if (existentes.length !== unicas.length) {
      throw new UnprocessableEntityException({
        message: 'Una de las sucursales elegidas no existe.',
        code: 'SUCURSAL_NO_ENCONTRADA',
      });
    }
    await this.alcanceRepository.reemplazarAcceso(usuarioId, [...new Set(permisos)], unicas, actorId);
  }
}

// Para los repositorios: true si la sucursal esta en el alcance (technical-spec 4.14)
export function alcanceIncluye(alcance: Alcance, sucursalId: string | null): boolean {
  return alcance.sinLimite || (sucursalId !== null && alcance.sucursalIds.includes(sucursalId));
}
