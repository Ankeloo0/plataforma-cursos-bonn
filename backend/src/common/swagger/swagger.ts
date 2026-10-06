import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Documentacion en /api/docs, solo si SWAGGER_ENABLED=true (desarrollo).
// En produccion queda apagada para no publicar el mapa de la API.
export function configurarSwagger(app: INestApplication): void {
  if (!app.get(ConfigService).get<boolean>('swagger.enabled')) return;

  const config = new DocumentBuilder()
    .setTitle('API de Cursos')
    .setDescription(
      'Plataforma de capacitación interna. Para probar las rutas protegidas, ejecuta primero ' +
        '**POST /auth/login**: la sesión queda en la cookie `bonn_sesion` y el navegador la envía en las siguientes peticiones.',
    )
    .setVersion('v1')
    .addCookieAuth('bonn_sesion')
    .build();

  const documento = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documento, {
    swaggerOptions: { withCredentials: true },
    customSiteTitle: 'API de Cursos',
  });
}
