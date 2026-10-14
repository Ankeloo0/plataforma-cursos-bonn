import { existsSync } from 'node:fs';
import { PASSWORD_POLITICA, PASSWORD_POLITICA_MENSAJE } from '../../common/constants/seguridad.js';
import { sembrarRoles } from './roles.seed.js';
import { sembrarSuperusuario } from './superusuario.seed.js';

// Datos iniciales de la instalacion: roles y superusuario. Se puede ejecutar varias veces: no duplica nada.
// Docker: docker compose -f infra/dev/docker-compose.yml exec api npm run seed
// Fuera de el: cd backend && npm run build && npm run seed (lee backend/.env)

const OBLIGATORIAS = [
  'SUPERUSER_EMPRESA',
  'SUPERUSER_EMPRESA_PREFIJO_FOLIO',
  'SUPERUSER_NUMERO_EMPLEADO',
  'SUPERUSER_PASSWORD',
  'SUPERUSER_NOMBRES',
  'SUPERUSER_APELLIDO_PATERNO',
];

function leerDatosSuperusuario() {
  const faltan = OBLIGATORIAS.filter((nombre) => !process.env[nombre]?.trim());
  if (faltan.length > 0) {
    throw new Error(`Faltan variables del superusuario: ${faltan.join(', ')}`);
  }
  const password = process.env.SUPERUSER_PASSWORD!;
  if (!PASSWORD_POLITICA.test(password)) {
    throw new Error(`SUPERUSER_PASSWORD: ${PASSWORD_POLITICA_MENSAJE}`);
  }
  const datos = {
    empresa: process.env.SUPERUSER_EMPRESA!.trim(),
    prefijoFolio: process.env.SUPERUSER_EMPRESA_PREFIJO_FOLIO!.trim().toUpperCase(),
    numeroEmpleado: process.env.SUPERUSER_NUMERO_EMPLEADO!.trim(),
    password,
    nombres: process.env.SUPERUSER_NOMBRES!.trim(),
    apellidoPaterno: process.env.SUPERUSER_APELLIDO_PATERNO!.trim(),
    apellidoMaterno: process.env.SUPERUSER_APELLIDO_MATERNO?.trim() || undefined,
  };
  // Las mismas reglas que los formularios y las columnas de la base
  if (datos.empresa.length > 120) throw new Error('SUPERUSER_EMPRESA no puede pasar de 120 caracteres.');
  if (!/^[A-Z0-9]{2,6}$/.test(datos.prefijoFolio)) {
    throw new Error('SUPERUSER_EMPRESA_PREFIJO_FOLIO debe tener de 2 a 6 letras sin acentos o números, por ejemplo GB.');
  }
  if (!/^[A-Za-z0-9-]{1,20}$/.test(datos.numeroEmpleado)) {
    throw new Error('SUPERUSER_NUMERO_EMPLEADO solo puede tener letras sin acentos, números y guion, hasta 20 caracteres.');
  }
  if (datos.nombres.length > 80) throw new Error('SUPERUSER_NOMBRES no puede pasar de 80 caracteres.');
  if (datos.apellidoPaterno.length > 60) throw new Error('SUPERUSER_APELLIDO_PATERNO no puede pasar de 60 caracteres.');
  if ((datos.apellidoMaterno?.length ?? 0) > 60) throw new Error('SUPERUSER_APELLIDO_MATERNO no puede pasar de 60 caracteres.');
  return datos;
}

async function main(): Promise<void> {
  // Fuera de Docker las variables estan en backend/.env; en Docker ya vienen en el entorno
  if (process.env.IGNORE_ENV_FILE !== 'true' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const datos = leerDatosSuperusuario();

  // Se importa despues de cargar el .env, porque el DataSource lee process.env al crearse
  const { default: dataSource } = await import('../data-source.js');
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      await sembrarRoles(manager);
      console.log('Roles: SUPERUSUARIO, ADMIN, EMPLEADO');

      const resultado = await sembrarSuperusuario(manager, datos);
      const mensajes = {
        creado: `Superusuario creado: entra con "${datos.empresa}" y el número ${datos.numeroEmpleado}. Deberá cambiar su contraseña al entrar.`,
        'numero-asignado': `El superusuario ya existía: ahora entra con "${datos.empresa}" y el número ${datos.numeroEmpleado}.`,
        'ya-existia': 'El superusuario ya existía; no se modificó.',
      };
      console.log(mensajes[resultado]);
    });
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('El seed falló:', error instanceof Error ? error.message : error);
  process.exit(1);
});
