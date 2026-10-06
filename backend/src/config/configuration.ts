export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  database: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    loginMaxIntentos: Number(process.env.LOGIN_MAX_INTENTOS ?? 5),
    loginBloqueoMinutos: Number(process.env.LOGIN_BLOQUEO_MINUTOS ?? 15),
    loginLimitePorMinuto: Number(process.env.LOGIN_LIMITE_POR_MINUTO ?? 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? '',
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED === 'true',
  },
  storage: {
    localPath: process.env.STORAGE_LOCAL_PATH ?? '/storage',
  },
});
