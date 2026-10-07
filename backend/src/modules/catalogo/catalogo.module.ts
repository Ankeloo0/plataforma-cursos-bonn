import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogoController } from './catalogo.controller.js';
import { CatalogoRepository } from './catalogo.repository.js';
import { CatalogoService } from './catalogo.service.js';
import { Area } from './entities/area.entity.js';
import { Puesto } from './entities/puesto.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Area, Puesto])],
  controllers: [CatalogoController],
  providers: [CatalogoRepository, CatalogoService],
  exports: [CatalogoService],
})
export class CatalogoModule {}
