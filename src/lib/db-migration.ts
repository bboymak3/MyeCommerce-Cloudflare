/**
 * Sistema de Migración de Base de Datos
 * 
 * Este sistema permite migrar de una versión a otra sin reinstalar
 * ni perder datos. Se ejecuta automáticamente al iniciar la app.
 * 
 * Flujo:
 * 1. Lee la versión actual de la BD (tabla _migration_history)
 * 2. Compara con la versión del package.json
 * 3. Ejecuta migraciones pendientes en orden
 * 4. Marca cada migración como completada
 * 
 * Cada migración puede:
 * - ALTER TABLE (agregar columnas con defaults)
 * - CREATE TABLE (tablas nuevas)
 * - UPDATE (transformar datos existentes)
 * - INSERT (sembrar datos iniciales)
 */

import { db } from './db';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Versión actual del sistema (se lee de package.json)
function getAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Asegurar que la tabla de migraciones existe
async function ensureMigrationTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS _migration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {
    console.error('[Migration] Error creando tabla de migraciones:', e);
  }
}

// Obtener la última versión migrada
async function getLastMigration(): Promise<string | null> {
  try {
    const result: any[] = await db.$queryRawUnsafe(
      `SELECT version FROM _migration_history ORDER BY applied_at DESC LIMIT 1`
    );
    return result.length > 0 ? result[0].version : null;
  } catch {
    return null;
  }
}

// Registrar migración completada
async function markMigrationApplied(version: string, description: string) {
  await db.$executeRawUnsafe(
    `INSERT OR IGNORE INTO _migration_history (version, description) VALUES (?, ?)`,
    version, description
  );
}

// Backup de la BD antes de migrar
function backupDatabase(): string | null {
  const dbPath = join(process.cwd(), 'prisma', 'dev.db');
  if (!existsSync(dbPath)) return null;

  const backupDir = join(process.cwd(), 'prisma', 'backups');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `pre-migration-${timestamp}.db`);
  try {
    copyFileSync(dbPath, backupPath);
    console.log(`[Migration] Backup creado: ${backupPath}`);
    return backupPath;
  } catch (e) {
    console.error('[Migration] Error creando backup:', e);
    return null;
  }
}

interface Migration {
  version: string;
  description: string;
  up: string[]; // SQL statements to execute
}

// Definición de migraciones por versión
const MIGRATIONS: Migration[] = [
  {
    version: '2.9.56',
    description: 'Agregar campos costo y margen al precio mayorista + API de logos mejorada',
    up: [
      // Agregar campos de costo/margen mayorista si no existen
      `ALTER TABLE Product ADD COLUMN wholesaleCost REAL DEFAULT 0`,
      `ALTER TABLE Product ADD COLUMN wholesaleMarginPercent REAL DEFAULT 0`,
    ],
  },
];

// Ejecutar una sola migración
async function executeMigration(migration: Migration) {
  console.log(`[Migration] Aplicando v${migration.version}: ${migration.description}`);

  for (const sql of migration.up) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e: any) {
      // Ignorar errores de "columna ya existe" (ya se migró antes)
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('duplicate column name') || msg.includes('already exists')) {
        console.log(`[Migration] Columna/tabla ya existe, saltando...`);
      } else {
        console.error(`[Migration] Error en SQL: ${sql}`, e?.message);
        throw e;
      }
    }
  }

  await markMigrationApplied(migration.version, migration.description);
  console.log(`[Migration] v${migration.version} completada exitosamente`);
}

// Función principal: ejecutar todas las migraciones pendientes
export async function runMigrations(): Promise<{ applied: number; version: string }> {
  try {
    await ensureMigrationTable();

    const lastVersion = await getLastMigration();
    const appVersion = getAppVersion();
    const pending = MIGRATIONS.filter(m => {
      if (!lastVersion) return true;
      // Comparar versiones: solo ejecutar migraciones con versión > última migrada
      return m.version > lastVersion && m.version <= appVersion;
    });

    if (pending.length === 0) {
      console.log(`[Migration] Base de datos actualizada (v${lastVersion || '0.0.0'})`);
      return { applied: 0, version: lastVersion || appVersion };
    }

    console.log(`[Migration] ${pending.length} migracion(es) pendiente(s): ${pending.map(m => 'v' + m.version).join(', ')}`);

    // Backup antes de migrar
    backupDatabase();

    // Ejecutar migraciones en orden
    for (const migration of pending) {
      await executeMigration(migration);
    }

    console.log(`[Migration] Todas las migraciones completadas. Version actual: v${appVersion}`);
    return { applied: pending.length, version: appVersion };
  } catch (e) {
    console.error('[Migration] Error fatal en migraciones:', e);
    return { applied: 0, version: getAppVersion() };
  }
}
