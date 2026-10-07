import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosModule } from '../archivos/archivos.module.js';
import { CursosAccesoService } from './cursos-acceso.service.js';
import { CursosController } from './cursos.controller.js';
import { CursosRepository } from './cursos.repository.js';
import { CursosService } from './cursos.service.js';
import { Curso } from './entities/curso.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Curso]), ArchivosModule],
  controllers: [CursosController],
  providers: [CursosRepository, CursosAccesoService, CursosService],
})
export class CursosModule {}
