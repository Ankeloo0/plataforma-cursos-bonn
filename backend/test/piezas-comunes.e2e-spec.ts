import { Controller, Get, Post, Query } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PERMISOS } from '../src/common/constants/permisos.js';
import { ROLES } from '../src/common/constants/roles.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { RequierePermiso } from '../src/common/decorators/requiere-permiso.decorator.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import { PaginatedResponseDto } from '../src/common/dto/paginated-response.dto.js';
import { PaginationQueryDto } from '../src/common/dto/pagination-query.dto.js';
import { crearAppE2e, type AppE2e } from './e2e/app.js';
import { limpiarBase } from './e2e/base-de-datos.js';
import { crearAdministrador, crearEmpresa } from './e2e/fabricas.js';
import { iniciarSesion } from './e2e/sesion.js';

// Controlador que solo existe en esta prueba, para ejercitar las piezas comunes a traves de HTTP.
@Controller('prueba')
class PruebaController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get('paginado')
  paginado(@Query() query: PaginationQueryDto) {
    return PaginatedResponseDto.crear(['x'], 45, query);
  }

  @Public()
  @Post('empresa-duplicada')
  async empresaDuplicada() {
    const [{ creado_por }] = await this.dataSource.query('SELECT creado_por FROM empresas LIMIT 1');
    await this.dataSource.query(
      `INSERT INTO empresas (nombre, prefijo_folio, creado_por) VALUES ('grupo centro', 'GC2', $1)`,
      [creado_por],
    );
  }

  @Roles(ROLES.ADMIN)
  @RequierePermiso(PERMISOS.REPORTES_VER)
  @Get('solo-admin')
  soloAdmin() {
    return 'nunca llega sin sesión';
  }

  @Roles(ROLES.ADMIN)
  @Get('admin-sin-permiso-declarado')
  adminSinPermiso() {
    return 'nunca llega';
  }

  @Get('sin-roles')
  sinRoles() {
    return 'nunca llega';
  }
}

describe('Piezas comunes a través de HTTP', () => {
  let e2e: AppE2e;
  const http = () => request(e2e.app.getHttpServer());

  beforeAll(async () => {
    e2e = await crearAppE2e([PruebaController]);
  });

  afterAll(async () => {
    await limpiarBase(e2e.dataSource);
    await e2e.app.close();
  });

  it('valida y convierte los parámetros de paginación', async () => {
    const respuesta = await http().get('/api/v1/prueba/paginado?page=2&limit=10').expect(200);
    expect(respuesta.body.meta).toEqual({ page: 2, limit: 10, total: 45, totalPages: 5 });

    await http().get('/api/v1/prueba/paginado?limit=500').expect(400);
    await http().get('/api/v1/prueba/paginado?campoInventado=1').expect(400);
  });

  it('traduce un duplicado de PostgreSQL a 409 con su código (AllExceptionsFilter)', async () => {
    await crearEmpresa(e2e.dataSource, { nombre: 'Grupo Centro' });

    const respuesta = await http().post('/api/v1/prueba/empresa-duplicada').expect(409);
    expect(respuesta.body).toEqual({
      statusCode: 409,
      error: 'CONFLICT',
      message: 'Ya existe una empresa con ese nombre.',
      code: 'EMPRESA_NOMBRE_DUPLICADO',
    });
  });

  it('pide sesión en las rutas con @Roles', async () => {
    const respuesta = await http().get('/api/v1/prueba/solo-admin').expect(401);
    expect(respuesta.body.code).toBe('SESION_REQUERIDA');
  });

  it('no deja abierta una ruta que olvidó declarar @Roles', async () => {
    await http().get('/api/v1/prueba/sin-roles').expect(401);

    const admin = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.REPORTES_VER] });
    const cookie = await iniciarSesion(e2e.app, admin.username);
    await http().get('/api/v1/prueba/sin-roles').set('Cookie', cookie).expect(403);
    await http().get('/api/v1/prueba/solo-admin').set('Cookie', cookie).expect(200);
  });

  it('exige el permiso declarado y no deja abierta una ruta de administrador sin permisos declarados (PermisosGuard)', async () => {
    const sinPermisos = await crearAdministrador(e2e.dataSource);
    const conTodo = await crearAdministrador(e2e.dataSource, { permisos: [PERMISOS.REPORTES_VER, PERMISOS.MARCAS_GESTIONAR] });
    const cookieSin = await iniciarSesion(e2e.app, sinPermisos.username);
    const cookieCon = await iniciarSesion(e2e.app, conTodo.username);

    const respuesta = await http().get('/api/v1/prueba/solo-admin').set('Cookie', cookieSin).expect(403);
    expect(respuesta.body.code).toBe('SIN_PERMISO');
    await http().get('/api/v1/prueba/admin-sin-permiso-declarado').set('Cookie', cookieCon).expect(403);
  });
});
