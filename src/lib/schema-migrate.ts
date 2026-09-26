// Migracion automatica de la D1 al arrancar (no requiere `wrangler d1 execute`).
//
// Es idempotente y NUNCA borra datos:
//  1. CREATE TABLE IF NOT EXISTS para las tablas que falten.
//  2. Agrega la columna tenant_id ('default') a las tablas que no la tengan.
//  3. Reemplaza los indices UNIQUE globales por indices UNIQUE por negocio.
//  4. Registra la version aplicada en _app_migrations para no repetir el trabajo.
import {
  SCHEMA_TABLES,
  CREATE_TABLE_STATEMENTS,
  DROP_LEGACY_UNIQUE_INDEXES,
  CREATE_INDEX_STATEMENTS,
} from './schema-sql.generated';

const MIGRATION_ID = '2026-09-26-multitenant';

let pending: Promise<void> | null = null;

/**
 * Asegura que el esquema de la D1 este al dia. Se ejecuta una vez por instancia;
 * despues de la primera vez solo cuesta una consulta.
 */
export function ensureSchema(d1: D1Database | undefined): Promise<void> {
  if (!d1) return Promise.resolve();
  if (!pending) {
    pending = migrate(d1).catch((error) => {
      pending = null; // reintentar en la proxima peticion
      throw error;
    });
  }
  return pending;
}

async function isApplied(d1: D1Database): Promise<boolean> {
  try {
    const row = await d1.prepare('SELECT id FROM _app_migrations WHERE id = ?').bind(MIGRATION_ID).first();
    return !!row;
  } catch {
    return false; // la tabla aun no existe
  }
}

async function runEach(d1: D1Database, statements: string[], errors: string[]) {
  for (const sql of statements) {
    try {
      await d1.prepare(sql).run();
    } catch (error: any) {
      errors.push(`${sql.slice(0, 80)}... -> ${error?.message || error}`);
    }
  }
}

async function migrate(d1: D1Database): Promise<void> {
  if (await isApplied(d1)) return;

  const errors: string[] = [];

  // 1) Tablas faltantes
  await runEach(d1, CREATE_TABLE_STATEMENTS, errors);

  // 2) Columna tenant_id donde falte
  for (const table of SCHEMA_TABLES) {
    try {
      const { results } = await d1.prepare(`PRAGMA table_info("${table}")`).all<{ name: string }>();
      if (results && results.length > 0 && !results.some(c => c.name === 'tenant_id')) {
        await d1.prepare(`ALTER TABLE "${table}" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default'`).run();
      }
    } catch (error: any) {
      // Otra instancia pudo agregarla al mismo tiempo
      if (!String(error?.message || '').includes('duplicate column')) {
        errors.push(`tenant_id en ${table} -> ${error?.message || error}`);
      }
    }
  }

  // 3) Unicidad por negocio (usuario, factura, categoria... repetibles entre negocios)
  await runEach(d1, DROP_LEGACY_UNIQUE_INDEXES, errors);
  await runEach(d1, CREATE_INDEX_STATEMENTS, errors);

  if (errors.length > 0) {
    console.warn(`[schema] Migracion ${MIGRATION_ID} con ${errors.length} aviso(s):\n` + errors.join('\n'));
  }

  // 4) Registrar (aunque haya avisos no criticos, p. ej. un indice sobre una columna antigua)
  await d1.prepare('CREATE TABLE IF NOT EXISTS "_app_migrations" ("id" TEXT NOT NULL PRIMARY KEY, "applied_at" TEXT NOT NULL)').run();
  await d1.prepare('INSERT OR IGNORE INTO "_app_migrations" ("id", "applied_at") VALUES (?, ?)')
    .bind(MIGRATION_ID, new Date().toISOString()).run();
  console.log(`[schema] Migracion ${MIGRATION_ID} aplicada`);
}
