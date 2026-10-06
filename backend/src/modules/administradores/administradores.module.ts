import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AdministradoresController } from './administradores.controller.js';
import { AdministradoresService } from './administradores.service.js';

@Module({
  imports: [UsuariosModule],
  controllers: [AdministradoresController],
  providers: [AdministradoresService],
})
export class AdministradoresModule {}
