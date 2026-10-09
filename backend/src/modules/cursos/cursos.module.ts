import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosModule } from '../archivos/archivos.module.js';
import { CursosAccesoService } from './cursos-acceso.service.js';
import { CursosController } from './cursos.controller.js';
import { CursosRepository } from './cursos.repository.js';
import { CursosService } from './cursos.service.js';
import { Curso } from './entities/curso.entity.js';
import { Material } from './entities/material.entity.js';
import { Tema } from './entities/tema.entity.js';
import { MaterialesController } from './materiales.controller.js';
import { MaterialesRepository } from './materiales.repository.js';
import { MaterialesService } from './materiales.service.js';
import { TemasController } from './temas.controller.js';
import { TemasRepository } from './temas.repository.js';
import { TemasService } from './temas.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Curso, Tema, Material]), ArchivosModule],
  controllers: [CursosController, TemasController, MaterialesController],
  providers: [
    CursosRepository,
    CursosAccesoService,
    CursosService,
    TemasRepository,
    TemasService,
    MaterialesRepository,
    MaterialesService,
  ],
})
export class CursosModule {}
