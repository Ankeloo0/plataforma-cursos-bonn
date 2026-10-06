import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { ArchivosController } from './archivos.controller.js';
import { ArchivosRepository } from './archivos.repository.js';
import { ArchivosService } from './archivos.service.js';
import { Archivo } from './entities/archivo.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Archivo])],
  controllers: [ArchivosController],
  providers: [ArchivosRepository, ArchivosService, AlmacenamientoService],
  exports: [ArchivosService],
})
export class ArchivosModule {}
