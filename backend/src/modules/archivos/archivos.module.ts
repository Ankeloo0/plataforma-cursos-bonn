import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import path from 'node:path';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { ArchivosController } from './archivos.controller.js';
import { ArchivosRepository } from './archivos.repository.js';
import { ArchivosService } from './archivos.service.js';
import { Archivo } from './entities/archivo.entity.js';
import { MediosService } from './medios.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Archivo]),
    // Solo afecta a ArchivosController: los archivos de materiales se escriben en <storage>/tmp.
    // Las fotos y portadas de otros modulos siguen en memoria.
    MulterModule.registerAsync({
      inject: [ConfigService],
      // dest: Multer guarda en disco con un nombre aleatorio y crea la carpeta si no existe
      useFactory: (config: ConfigService) => ({
        dest: path.join(path.resolve(config.get<string>('storage.localPath') ?? '/storage'), 'tmp'),
      }),
    }),
  ],
  controllers: [ArchivosController],
  providers: [ArchivosRepository, ArchivosService, AlmacenamientoService, MediosService],
  exports: [ArchivosService, MediosService],
})
export class ArchivosModule {}
