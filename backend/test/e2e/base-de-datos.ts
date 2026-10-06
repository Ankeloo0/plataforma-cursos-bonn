/// <reference types="vite/client" />
import { DataSource, type MigrationInterface } from 'typeorm';
import { sembrarRoles } from '../../src/database/seeds/roles.seed.js';

// Vite reune todas las migraciones escritas en TypeScript; no hace falta compilar antes de probar.
const modulosMigraciones = import.meta.glob<Record<string, new () => MigrationInterface>>(
  '../../src/database/migrations/*.ts',
  { eager: true },
);
const migraciones = Object.values(modulosMigraciones).flatMap((modulo) => Object.values(modulo));

export function crearDataSourcePruebas(database = process.env.DB_NAME): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    migrations: migraciones,
  });
}

// Deja la base de pruebas lista desde cero: la crea si no existe, borra su esquema,
// aplica todas las migraciones y carga los roles.
export async function prepararBasePruebas(): Promise<void> {
  const nombre = process.env.DB_NAME!;
  if (!/^[a-z0-9_]+$/.test(nombre)) {
    throw new Error(`Nombre de base de pruebas inválido: ${nombre}`);
  }

  // Conexion a la base "postgres" solo para crear la de pruebas.
  const admin = crearDataSourcePruebas('postgres');
  await admin.initialize();
  const existe: unknown[] = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
  if (existe.length === 0) {
    await admin.query(`CREATE DATABASE ${nombre}`);
  }
  await admin.destroy();

  const ds = crearDataSourcePruebas();
  await ds.initialize();
  await ds.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ds.runMigrations();
  await sembrarRoles(ds.manager);
  await ds.destroy();
}

// Tablas que se vacian entre pruebas; roles y migrations se conservan
const TABLAS_DE_DATOS = [
  'administradores_sucursales',
  'usuarios_permisos',
  'archivos',
  'usuarios',
  'sucursales',
  'marcas',
  'empresas',
];

export async function limpiarBase(ds: DataSource): Promise<void> {
  await ds.query(`TRUNCATE ${TABLAS_DE_DATOS.join(', ')} RESTART IDENTITY CASCADE`);
}
