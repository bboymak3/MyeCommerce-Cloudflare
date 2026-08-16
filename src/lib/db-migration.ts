/**
 * Sistema de Migracion de Base de Datos
 * 
 * Este sistema permite migrar de una version a otra sin reinstalar
 * ni perder datos. Se ejecuta automaticamente al iniciar la app
 * via instrumentation.ts.
 * 
 * Flujo:
 * 1. Lee la version actual de la BD (tabla _migration_history)
 * 2. Compara con la version del package.json
 * 3. Ejecuta migraciones pendientes en orden
 * 4. Marca cada migracion como completada
 * 
 * Cada migracion puede:
 * - ALTER TABLE (agregar columnas con defaults)
 * - CREATE TABLE (tablas nuevas)
 * - CREATE INDEX (indices nuevos)
 * - UPDATE (transformar datos existentes)
 * - INSERT (sembrar datos iniciales)
 * 
 * Seguridad:
 * - Backup automatico de la BD antes de cada batch de migraciones
 * - Errores de "columna ya existe" se ignoran (idempotente)
 * - Cada migracion se registra individualmente
 * - Si falla una, las migraciones posteriores no se ejecutan
 */

import { db } from './db';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import { getAppVersion, compareVersions } from './version';

// ─── Tipos ──────────────────────────────────────────────────────
interface Migration {
  version: string;
  description: string;
  up: string[]; // SQL statements
}

// ─── Utilidades ─────────────────────────────────────────────────

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

async function getAppliedVersions(): Promise<string[]> {
  try {
    const result: any[] = await db.$queryRawUnsafe(
      `SELECT version FROM _migration_history ORDER BY applied_at ASC`
    );
    return result.map((r: any) => r.version);
  } catch {
    return [];
  }
}

async function markMigrationApplied(version: string, description: string) {
  await db.$executeRawUnsafe(
    `INSERT OR IGNORE INTO _migration_history (version, description) VALUES (?, ?)`,
    version, description
  );
}

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
    // Copiar tambien WAL y SHM si existen
    copyFileSync(dbPath, backupPath);
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (existsSync(walPath)) copyFileSync(walPath, backupPath + '-wal');
    if (existsSync(shmPath)) copyFileSync(shmPath, backupPath + '-shm');
    console.log(`[Migration] Backup creado: ${backupPath}`);
    return backupPath;
  } catch (e) {
    console.error('[Migration] Error creando backup:', e);
    return null;
  }
}

// ─── Definicion de Migraciones ──────────────────────────────────
// 
// IMPORTANTE: Cada migracion debe ser idempotente (poder ejecutarse
// multiples veces sin errores). Usar "ADD COLUMN" que falla si ya
// existe (se captura el error), o "IF NOT EXISTS" para tablas.
// 
// Ordenar por version de menor a mayor. El sistema solo ejecuta
// las migraciones con version > ultima migrada AND <= version actual.

const MIGRATIONS: Migration[] = [
  // ─── v2.9.56 ────────────────────────────────────────────────
  {
    version: '2.9.56',
    description: 'Campos costo/margen mayorista + mejoras de logo API',
    up: [
      `ALTER TABLE Product ADD COLUMN wholesaleCost REAL DEFAULT 0`,
      `ALTER TABLE Product ADD COLUMN wholesaleMarginPercent REAL DEFAULT 0`,
    ],
  },

  // ─── v2.9.57 ────────────────────────────────────────────────
  {
    version: '2.9.57',
    description: 'Campos ticket config (monto recibido, logo) + fix auth en impresion',
    up: [
      // Estos campos pueden ya existir si se creo BD con schema actual
      `ALTER TABLE Settings ADD COLUMN ticketShowCashReceived BOOLEAN DEFAULT 1`,
      `ALTER TABLE Settings ADD COLUMN ticketShowLogo BOOLEAN DEFAULT 1`,
    ],
  },

  // ─── v2.9.58 ────────────────────────────────────────────────
  // (Reservado para proximos cambios de schema)
  // {
  //   version: '2.9.58',
  //   description: 'Descripcion del cambio',
  //   up: [
  //     `ALTER TABLE ...`,
  //   ],
  // },
];

// ─── Ejecucion ─────────────────────────────────────────────────

async function executeMigration(migration: Migration) {
  console.log(`[Migration] Aplicando v${migration.version}: ${migration.description}`);

  for (const sql of migration.up) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (
        msg.includes('duplicate column name') ||
        msg.includes('already exists') ||
        msg.includes('duplicate table name')
      ) {
        console.log(`  [Migration] Ya existe, saltando...`);
      } else {
        console.error(`  [Migration] ERROR en SQL: ${sql}`);
        console.error(`  [Migration] Detalle: ${e?.message}`);
        throw e;
      }
    }
  }

  await markMigrationApplied(migration.version, migration.description);
  console.log(`[Migration] v${migration.version} completada`);
}

/**
 * Funcion principal: ejecutar todas las migraciones pendientes.
 * Se llama automaticamente desde instrumentation.ts al iniciar la app.
 * 
 * Retorna:
 * - applied: cantidad de migraciones ejecutadas
 * - version: version actual del sistema
 * - details: lista de migraciones aplicadas (para UI)
 */
export async function runMigrations(): Promise<{
  applied: number;
  version: string;
  details: { version: string; description: string; applied: boolean }[];
}> {
  try {
    await ensureMigrationTable();

    const lastVersion = await getLastMigration();
    const appVersion = getAppVersion();
    const appliedVersions = await getAppliedVersions();

    // Filtrar migraciones pendientes
    const pending = MIGRATIONS.filter(m => {
      if (appliedVersions.includes(m.version)) return false; // Ya aplicada
      if (!lastVersion) return compareVersions(m.version, appVersion) <= 0;
      return compareVersions(m.version, lastVersion) > 0 && compareVersions(m.version, appVersion) <= 0;
    });

    if (pending.length === 0) {
      console.log(`[Migration] BD actualizada (v${lastVersion || '0.0.0'} -> v${appVersion})`);
      return {
        applied: 0,
        version: lastVersion || appVersion,
        details: MIGRATIONS.map(m => ({
          version: m.version,
          description: m.description,
          applied: appliedVersions.includes(m.version),
        })),
      };
    }

    console.log(`[Migration] ${pending.length} migracion(es) pendiente(s): ${pending.map(m => 'v' + m.version).join(', ')}`);

    // Backup antes de migrar
    const backupPath = backupDatabase();
    if (!backupPath) {
      console.warn('[Migration] No se pudo crear backup. Continuando...');
    }

    // Ejecutar migraciones en orden
    const executed: { version: string; description: string; applied: boolean }[] = [];
    for (const migration of pending) {
      await executeMigration(migration);
      executed.push({ version: migration.version, description: migration.description, applied: true });
    }

    console.log(`[Migration] Todas completadas. Version actual: v${appVersion}`);

    return {
      applied: pending.length,
      version: appVersion,
      details: MIGRATIONS.map(m => ({
        version: m.version,
        description: m.description,
        applied: appliedVersions.includes(m.version) || executed.some(e => e.version === m.version),
      })),
    };
  } catch (e) {
    console.error('[Migration] ERROR FATAL:', e);
    return {
      applied: 0,
      version: getAppVersion(),
      details: MIGRATIONS.map(m => ({
        version: m.version,
        description: m.description,
        applied: false,
      })),
    };
  }
}
