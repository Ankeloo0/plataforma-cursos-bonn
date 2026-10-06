import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarcasModule } from '../marcas/marcas.module.js';
import { EmpresasController } from './empresas.controller.js';
import { EmpresasRepository } from './empresas.repository.js';
import { EmpresasService } from './empresas.service.js';
import { Empresa } from './entities/empresa.entity.js';
import { Sucursal } from './entities/sucursal.entity.js';
import { SucursalesController } from './sucursales.controller.js';
import { SucursalesRepository } from './sucursales.repository.js';
import { SucursalesService } from './sucursales.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Empresa, Sucursal]), MarcasModule],
  controllers: [EmpresasController, SucursalesController],
  providers: [EmpresasRepository, EmpresasService, SucursalesRepository, SucursalesService],
  exports: [EmpresasService, SucursalesService],
})
export class EmpresasModule {}
