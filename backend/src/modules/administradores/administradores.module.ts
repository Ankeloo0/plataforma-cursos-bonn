import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AdministradoresController } from './administradores.controller.js';
import { AdministradoresService } from './administradores.service.js';

@Module({
  imports: [UsuariosModule, EmpresasModule],
  controllers: [AdministradoresController],
  providers: [AdministradoresService],
})
export class AdministradoresModule {}
