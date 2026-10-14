// Migracion automatica de la D1 al arrancar (no requiere `wrangler d1 execute`).
//
// Es idempotente y NUNCA borra datos:
//  1. CREATE TABLE IF NOT EXISTS para las tablas que falten.
//  2. Agrega cualquier columna del esquema que falte en una tabla existente
//     (tenant_id, y cualquier columna nueva agregada despues, p. ej. bcvAutoUpdate).
//  3. Reemplaza los indices UNIQUE globales por indices UNIQUE por negocio.
//
// Se corre una vez por instancia de Worker (cacheado en `pending`), asi que
// agregar una columna nueva al esquema no requiere bump de version: en el
// proximo despliegue, el siguiente arranque de cada isolate la agrega sola.
import {
  SCHEMA_TABLES,
  CREATE_TABLE_STATEMENTS,
  DROP_LEGACY_UNIQUE_INDEXES,
  CREATE_INDEX_STATEMENTS,
} from './schema-sql.generated';

let pending: Promise<void> | null = null;

/**
 * Asegura que el esquema de la D1 este al dia. Se ejecuta una vez por instancia;
 * despues de la primera vez no vuelve a consultar la D1.
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

async function runEach(d1: D1Database, statements: string[], errors: string[], ignoreDuplicateColumn = false) {
  for (const sql of statements) {
    try {
      await d1.prepare(sql).run();
    } catch (error: any) {
      if (ignoreDuplicateColumn && String(error?.message || '').includes('duplicate column')) continue;
      errors.push(`${sql.slice(0, 80)}... -> ${error?.message || error}`);
    }
  }
}

// Ejecuta varios statements en un solo viaje a la D1 (mucho mas rapido que uno
// por uno al arrancar un isolate). Si el batch entero falla (p. ej. una carrera
// entre isolates agregando la misma columna a la vez), reintenta uno por uno
// para no perder el resto por culpa de un solo statement.
async function runBatch(d1: D1Database, statements: string[], errors: string[], ignoreDuplicateColumn = false) {
  if (statements.length === 0) return;
  try {
    await d1.batch(statements.map((sql) => d1.prepare(sql)));
  } catch {
    await runEach(d1, statements, errors, ignoreDuplicateColumn);
  }
}

interface ColumnDef { name: string; type: string; notNull: boolean; defaultClause: string }

// Extrae "columna TIPO [NOT NULL] [DEFAULT ...]" de un CREATE TABLE.
// Las columnas de una FOREIGN KEY/REFERENCES no llevan un tipo justo despues
// del nombre, asi que el patron no las confunde con columnas reales.
const COLUMN_RE = /"(\w+)"\s+(TEXT|INTEGER|REAL|BOOLEAN|DATETIME|BLOB)\b((?:\s+NOT NULL)?)((?:\s+DEFAULT\s+(?:'[^']*'|\([^)]*\)|[^,\s)]+))?)/g;

function parseColumns(createStatement: string): ColumnDef[] {
  const cols: ColumnDef[] = [];
  COLUMN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COLUMN_RE.exec(createStatement))) {
    cols.push({ name: m[1], type: m[2], notNull: !!m[3].trim(), defaultClause: m[4].trim() });
  }
  return cols;
}

function tableNameOf(createStatement: string): string | null {
  return createStatement.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/)?.[1] || null;
}

async function migrate(d1: D1Database): Promise<void> {
  const errors: string[] = [];

  // 1) Tablas faltantes — un solo viaje a la D1 para todas
  await runBatch(d1, CREATE_TABLE_STATEMENTS, errors);

  // 2) Columnas faltantes en tablas existentes (tenant_id y cualquier columna nueva).
  // Las PRAGMA table_info de todas las tablas se piden juntas en un solo viaje.
  const byTable = new Map<string, ColumnDef[]>();
  for (const stmt of CREATE_TABLE_STATEMENTS) {
    const table = tableNameOf(stmt);
    if (table) byTable.set(table, parseColumns(stmt));
  }

  const alterStatements: string[] = [];
  try {
    const pragmaResults = await d1.batch<{ name: string }>(
      SCHEMA_TABLES.map((table) => d1.prepare(`PRAGMA table_info("${table}")`))
    );
    SCHEMA_TABLES.forEach((table, i) => {
      const expected = byTable.get(table);
      if (!expected) return;
      const results = pragmaResults[i]?.results;
      if (!results || results.length === 0) return; // la tabla no existe (no deberia pasar tras el paso 1)
      const existing = new Set(results.map((c) => c.name));
      for (const col of expected) {
        if (existing.has(col.name)) continue;
        // ALTER TABLE ADD COLUMN no admite NOT NULL sin DEFAULT sobre una tabla con filas;
        // en este esquema toda columna no nula ya trae DEFAULT, asi que siempre es segura.
        const notNull = col.notNull && col.defaultClause ? ' NOT NULL' : '';
        alterStatements.push(`ALTER TABLE "${table}" ADD COLUMN "${col.name}" ${col.type}${notNull} ${col.defaultClause}`.trim());
      }
    });
  } catch (error: any) {
    errors.push(`PRAGMA table_info -> ${error?.message || error}`);
  }
  // Si un isolate concurrente agrego la misma columna al mismo tiempo, el batch
  // entero fallaria por "duplicate column": se reintenta una por una ignorando eso.
  await runBatch(d1, alterStatements, errors, true);

  // 3) Unicidad por negocio (usuario, factura, categoria... repetibles entre negocios) — un viaje
  await runBatch(d1, [...DROP_LEGACY_UNIQUE_INDEXES, ...CREATE_INDEX_STATEMENTS], errors);

  if (errors.length > 0) {
    console.warn(`[schema] Sincronizacion de esquema con ${errors.length} aviso(s):\n` + errors.join('\n'));
  } else {
    console.log('[schema] Esquema sincronizado');
  }
}
