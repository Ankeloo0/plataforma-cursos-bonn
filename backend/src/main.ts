import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configurarApp(app);

  // En produccion el frontend y la API comparten origen (nginx), asi que CORS queda apagado.
  const corsOrigin = config.get<string>('cors.origin');
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(','), credentials: true });
  }

  app.enableShutdownHooks();
  await app.listen(config.get<number>('port') ?? 3000, '0.0.0.0');
}
await bootstrap();
