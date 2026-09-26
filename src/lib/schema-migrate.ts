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

async function runEach(d1: D1Database, statements: string[], errors: string[]) {
  for (const sql of statements) {
    try {
      await d1.prepare(sql).run();
    } catch (error: any) {
      errors.push(`${sql.slice(0, 80)}... -> ${error?.message || error}`);
    }
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

  // 1) Tablas faltantes
  await runEach(d1, CREATE_TABLE_STATEMENTS, errors);

  // 2) Columnas faltantes en tablas existentes (tenant_id y cualquier columna nueva)
  const byTable = new Map<string, ColumnDef[]>();
  for (const stmt of CREATE_TABLE_STATEMENTS) {
    const table = tableNameOf(stmt);
    if (table) byTable.set(table, parseColumns(stmt));
  }
  for (const table of SCHEMA_TABLES) {
    const expected = byTable.get(table);
    if (!expected) continue;
    try {
      const { results } = await d1.prepare(`PRAGMA table_info("${table}")`).all<{ name: string }>();
      if (!results || results.length === 0) continue; // la tabla no existe (no deberia pasar tras el paso 1)
      const existing = new Set(results.map(c => c.name));
      for (const col of expected) {
        if (existing.has(col.name)) continue;
        // ALTER TABLE ADD COLUMN no admite NOT NULL sin DEFAULT sobre una tabla con filas;
        // en este esquema toda columna no nula ya trae DEFAULT, asi que siempre es segura.
        const notNull = col.notNull && col.defaultClause ? ' NOT NULL' : '';
        try {
          await d1.prepare(`ALTER TABLE "${table}" ADD COLUMN "${col.name}" ${col.type}${notNull} ${col.defaultClause}`.trim()).run();
        } catch (error: any) {
          if (!String(error?.message || '').includes('duplicate column')) {
            errors.push(`${col.name} en ${table} -> ${error?.message || error}`);
          }
        }
      }
    } catch (error: any) {
      errors.push(`PRAGMA ${table} -> ${error?.message || error}`);
    }
  }

  // 3) Unicidad por negocio (usuario, factura, categoria... repetibles entre negocios)
  await runEach(d1, DROP_LEGACY_UNIQUE_INDEXES, errors);
  await runEach(d1, CREATE_INDEX_STATEMENTS, errors);

  if (errors.length > 0) {
    console.warn(`[schema] Sincronizacion de esquema con ${errors.length} aviso(s):\n` + errors.join('\n'));
  } else {
    console.log('[schema] Esquema sincronizado');
  }
}
