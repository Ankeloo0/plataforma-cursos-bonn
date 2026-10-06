// Los decoradores de class-transformer y TypeORM leen metadatos con Reflect.getMetadata.
// NestJS carga esta libreria al arrancar; en las pruebas se carga aqui.
import 'reflect-metadata';
