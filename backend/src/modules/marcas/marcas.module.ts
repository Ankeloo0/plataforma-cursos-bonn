import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marca } from './entities/marca.entity.js';
import { MarcasController } from './marcas.controller.js';
import { MarcasRepository } from './marcas.repository.js';
import { MarcasService } from './marcas.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Marca])],
  controllers: [MarcasController],
  providers: [MarcasRepository, MarcasService],
  exports: [MarcasService],
})
export class MarcasModule {}
