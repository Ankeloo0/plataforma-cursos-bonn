import Joi from 'joi';

// La API no arranca si falta una variable obligatoria o tiene un formato invalido.
// Asi un error de configuracion se detecta al iniciar y no a mitad de una operacion.
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  TZ: Joi.string().default('America/Mexico_City'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),

  // Un secreto corto se puede adivinar por fuerza bruta: se exigen al menos 32 caracteres
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),
  COOKIE_SECURE: Joi.boolean().default(false),
  LOGIN_MAX_INTENTOS: Joi.number().integer().min(1).default(5),
  LOGIN_BLOQUEO_MINUTOS: Joi.number().integer().min(1).default(15),
  LOGIN_LIMITE_POR_MINUTO: Joi.number().integer().min(1).default(10),

  CORS_ORIGIN: Joi.string().allow('').default(''),
  STORAGE_LOCAL_PATH: Joi.string().default('/storage'),
  SWAGGER_ENABLED: Joi.boolean().default(false),

  // Solo las usa el seed (npm run seed); la API las acepta vacias
  SUPERUSER_USERNAME: Joi.string().allow(''),
  SUPERUSER_PASSWORD: Joi.string().allow(''),
  SUPERUSER_NOMBRES: Joi.string().allow(''),
  SUPERUSER_APELLIDO_PATERNO: Joi.string().allow(''),
  SUPERUSER_APELLIDO_MATERNO: Joi.string().allow(''),
});
