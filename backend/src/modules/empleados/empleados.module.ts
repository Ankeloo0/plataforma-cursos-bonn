import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogoModule } from '../catalogo/catalogo.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { EmpleadosController } from './empleados.controller.js';
import { EmpleadosRepository } from './empleados.repository.js';
import { EmpleadosService } from './empleados.service.js';
import { Empleado } from './entities/empleado.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Empleado]), UsuariosModule, CatalogoModule],
  controllers: [EmpleadosController],
  providers: [EmpleadosRepository, EmpleadosService],
})
export class EmpleadosModule {}
