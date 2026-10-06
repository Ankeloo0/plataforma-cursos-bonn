import { NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function errorPg(driverError: { code: string; constraint?: string; detail?: string }): QueryFailedError {
  return new QueryFailedError('INSERT ...', [], Object.assign(new Error('pg'), driverError));
}

describe('AllExceptionsFilter', () => {
  const filtro = new AllExceptionsFilter();

  it('conserva el estado, el mensaje y el code de un error HTTP', () => {
    const body = filtro.toErrorBody(new NotFoundException({ message: 'La marca no existe.', code: 'MARCA_NO_ENCONTRADA' }));
    expect(body).toEqual({ statusCode: 404, error: 'NOT_FOUND', message: 'La marca no existe.', code: 'MARCA_NO_ENCONTRADA' });
  });

  it('traduce el 413 de Multer a un mensaje en español', () => {
    expect(filtro.toErrorBody(new PayloadTooLargeException())).toMatchObject({ statusCode: 413, code: 'ARCHIVO_DEMASIADO_GRANDE' });
  });

  it('traduce un duplicado conocido a 409 con su código específico', () => {
    const body = filtro.toErrorBody(errorPg({ code: '23505', constraint: 'uq_usuarios_username_ci' }));
    expect(body).toMatchObject({ statusCode: 409, code: 'USUARIO_USERNAME_DUPLICADO' });
  });

  it('traduce un duplicado sin mensaje propio a 409 genérico', () => {
    const body = filtro.toErrorBody(errorPg({ code: '23505', constraint: 'uq_otra_tabla' }));
    expect(body).toMatchObject({ statusCode: 409, code: 'REGISTRO_DUPLICADO' });
  });

  it('distingue una llave foránea en uso de una referencia inexistente', () => {
    const enUso = filtro.toErrorBody(
      errorPg({ code: '23503', detail: 'Key (id)=(x) is still referenced from table "usuarios".' }),
    );
    const inexistente = filtro.toErrorBody(
      errorPg({ code: '23503', detail: 'Key (empresa_id)=(x) is not present in table "empresas".' }),
    );
    expect(enUso).toMatchObject({ statusCode: 409, code: 'REGISTRO_EN_USO' });
    expect(inexistente).toMatchObject({ statusCode: 409, code: 'REFERENCIA_INVALIDA' });
  });

  it('traduce un CHECK violado a 422', () => {
    const body = filtro.toErrorBody(errorPg({ code: '23514', constraint: 'ck_usuarios_sucursal_por_rol' }));
    expect(body).toMatchObject({ statusCode: 422, code: 'DATOS_INVALIDOS' });
  });

  it('nunca envía el detalle de PostgreSQL al cliente', () => {
    const body = filtro.toErrorBody(
      errorPg({ code: '23505', detail: 'Key (lower(username))=(jperez) already exists.' }),
    );
    expect(JSON.stringify(body)).not.toContain('jperez');
  });

  it('responde 500 genérico ante cualquier otro error, sin detalles', () => {
    const body = filtro.toErrorBody(errorPg({ code: '42P01' }));
    expect(body.statusCode).toBe(500);
    expect(body.code).toBeUndefined();
    expect(filtro.toErrorBody(new Error('secreto interno')).message).not.toContain('secreto');
  });
});
