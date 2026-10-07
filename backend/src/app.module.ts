import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermisosGuard } from './common/guards/permisos.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AdministradoresModule } from './modules/administradores/administradores.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogoModule } from './modules/catalogo/catalogo.module.js';
import { EmpleadosModule } from './modules/empleados/empleados.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { MustChangePasswordGuard } from './modules/auth/guards/must-change-password.guard.js';
import { EmpresasModule } from './modules/empresas/empresas.module.js';
import configuration from './config/configuration.js';
import { envValidationSchema } from './config/env.validation.js';
import { HealthModule } from './modules/health/health.module.js';
import { MarcasModule } from './modules/marcas/marcas.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.IGNORE_ENV_FILE === 'true',
      load: [configuration],
      validationSchema: envValidationSchema
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        database: config.get<string>('database.name'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        autoLoadEntities: true,
        // Nunca sincronizar el esquema automaticamente: todo cambio es una migracion (RNF-12).
        synchronize: false,
      }),
    }),
    HealthModule,
    AuthModule,
    EmpresasModule,
    MarcasModule,
    AdministradoresModule,
    CatalogoModule,
    EmpleadosModule,
  ],
  // Se ejecutan en este orden: sesion, contrasena temporal, rol y permiso (technical-spec 4.7)
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
