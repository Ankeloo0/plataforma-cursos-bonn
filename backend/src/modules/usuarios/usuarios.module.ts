import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosModule } from '../archivos/archivos.module.js';
import { AlcanceRepository } from './alcance.repository.js';
import { AlcanceService } from './alcance.service.js';
import { AdministradorSucursal } from './entities/administrador-sucursal.entity.js';
import { UsuarioPermiso } from './entities/usuario-permiso.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { PerfilController } from './perfil.controller.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosRepository } from './usuarios.repository.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, UsuarioPermiso, AdministradorSucursal]), ArchivosModule],
  controllers: [PerfilController, UsuariosController],
  providers: [UsuariosRepository, UsuariosService, AlcanceRepository, AlcanceService],
  exports: [UsuariosService, AlcanceService],
})
export class UsuariosModule {}
