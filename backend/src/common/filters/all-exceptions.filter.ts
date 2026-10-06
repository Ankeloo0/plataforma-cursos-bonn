import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { MENSAJES_RESTRICCIONES } from './mensajes-restricciones.js';

// Formato unico de error de la API
export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
}

// Codigos de error de PostgreSQL que se traducen
const PG_UNICO_DUPLICADO = '23505';
const PG_LLAVE_FORANEA = '23503';
const PG_CHECK = '23514';

// Atrapa todos los errores y les da el mismo formato.
// Un error no controlado se escribe en el log, pero el cliente solo recibe un mensaje generico
// para no exponer detalles internos (consultas, valores de la base, stack trace).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toErrorBody(exception);
    response.status(body.statusCode).json(body);
  }

  toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) return this.errorHttp(exception);
    if (exception instanceof QueryFailedError) return this.errorBaseDeDatos(exception);

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return this.errorInterno();
  }

  private errorHttp(exception: HttpException): ErrorBody {
    const status = exception.getStatus();
    // Multer rechaza el archivo antes de llegar al service, con un mensaje en ingles
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      return this.cuerpo(status, 'ARCHIVO_DEMASIADO_GRANDE', 'El archivo supera el tamaño máximo permitido.');
    }
    const payload = exception.getResponse();
    const detalle = typeof payload === 'string' ? { message: payload } : (payload as Partial<ErrorBody>);
    return {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message: detalle.message ?? exception.message,
      code: detalle.code,
    };
  }

  // Un UNIQUE, FK o CHECK que se viola llega aqui. Nunca se envia el "detail" de PostgreSQL,
  // porque contiene los valores de la fila.
  private errorBaseDeDatos(exception: QueryFailedError): ErrorBody {
    const pg = exception.driverError as { code?: string; constraint?: string; detail?: string };
    const propio = pg.constraint ? MENSAJES_RESTRICCIONES[pg.constraint] : undefined;

    if (pg.code === PG_UNICO_DUPLICADO) {
      return propio
        ? this.cuerpo(HttpStatus.CONFLICT, propio.code, propio.message)
        : this.cuerpo(HttpStatus.CONFLICT, 'REGISTRO_DUPLICADO', 'Ya existe un registro con esos datos.');
    }

    if (pg.code === PG_LLAVE_FORANEA) {
      // Al borrar el detalle dice "still referenced"; al insertar, "is not present"
      if (pg.detail?.includes('still referenced')) {
        return this.cuerpo(HttpStatus.CONFLICT, 'REGISTRO_EN_USO', 'No se puede eliminar porque otros registros dependen de él.');
      }
      return this.cuerpo(HttpStatus.CONFLICT, 'REFERENCIA_INVALIDA', 'Uno de los datos relacionados no existe.');
    }

    if (pg.code === PG_CHECK) {
      // La base detuvo algo que el service debio validar antes: se deja en el log para corregirlo
      this.logger.warn(`CHECK violado: ${pg.constraint ?? 'sin nombre'}`);
      return this.cuerpo(HttpStatus.UNPROCESSABLE_ENTITY, 'DATOS_INVALIDOS', 'Los datos no cumplen las reglas de la plataforma.');
    }

    this.logger.error(exception.stack ?? exception.message);
    return this.errorInterno();
  }

  private errorInterno(): ErrorBody {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
    };
  }

  private cuerpo(status: HttpStatus, code: string, message: string): ErrorBody {
    return { statusCode: status, error: HttpStatus[status], message, code };
  }
}
