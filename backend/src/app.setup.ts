import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { configurarSwagger } from './common/swagger/swagger.js';

// Configuracion HTTP comun. La usan main.ts y las pruebas e2e,
// para que las pruebas ejerciten la misma aplicacion que produccion.
export function configurarApp(app: INestApplication): void {
  app.use(helmet());
  app.use(cookieParser());
  // La API corre detras de nginx (o del proxy de Vite): la IP real llega en X-Forwarded-For.
  // Sin esto, el limite de inicio de sesion se aplicaria a todos los usuarios como si fueran una sola IP.
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      // Descarta los campos que no declara el DTO y rechaza la peticion si llegan (asignacion masiva)
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  configurarSwagger(app);
}
