// Escrituras atomicas en D1.
//
// El adaptador de Prisma para D1 ignora las transacciones: `db.$transaction([...])`
// ejecuta cada operacion por separado, y si una falla a mitad de camino la venta
// (o compra, abono...) queda a medias. `D1Database.batch()` si es atomico: si una
// sentencia falla, D1 deshace todo el lote.
//
// D1Batch arma esas sentencias con el mismo formato que usa Prisma (fechas ISO con
// "+00:00", booleanos 1/0) y SIEMPRE con el tenant_id del negocio, ya que aqui no
// aplica el aislamiento automatico de src/lib/db.ts. Las columnas se validan contra
// el esquema para que un nombre mal escrito falle en vez de perderse en silencio.
import { CREATE_TABLE_STATEMENTS } from './schema-sql.generated';

type Increment = { increment: number } | { decrement: number };
export type BatchValue = string | number | boolean | Date | null | undefined;

/** Valor calculado por la base de datos al ejecutar el lote (p. ej. un subquery). */
export class SqlExpr {
  constructor(readonly sql: string, readonly params: BatchValue[]) {}
}

/**
 * Expresion SQL como valor de insert(). Se evalua dentro de la transaccion del lote,
 * asi que ve lo que escribieron los lotes anteriores (sin carreras entre cajas).
 */
export function sqlExpr(sql: string, ...params: BatchValue[]): SqlExpr {
  return new SqlExpr(sql, params);
}

interface TableInfo {
  columns: Set<string>;
  // Columnas DATETIME que Prisma llena con la hora actual (@default(now()) / @updatedAt).
  // Se completan aqui: el DEFAULT CURRENT_TIMESTAMP de SQLite guarda otro formato
  // ("2026-01-01 10:00:00") y rompe las comparaciones de fechas de Prisma.
  nowColumns: string[];
}

let tables: Map<string, TableInfo> | null = null;

function tableInfo(table: string): TableInfo {
  if (!tables) {
    tables = new Map();
    for (const sql of CREATE_TABLE_STATEMENTS) {
      const name = sql.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/)?.[1];
      if (!name) continue;
      const info: TableInfo = { columns: new Set(), nowColumns: [] };
      for (const m of sql.matchAll(/"(\w+)"\s+(TEXT|INTEGER|REAL|BOOLEAN|DATETIME|BLOB)\b(\s+NOT NULL)?(\s+DEFAULT CURRENT_TIMESTAMP)?/g)) {
        info.columns.add(m[1]);
        if (m[2] === 'DATETIME' && (m[4] || (m[3] && m[1] === 'updatedAt'))) info.nowColumns.push(m[1]);
      }
      tables.set(name, info);
    }
  }
  const info = tables.get(table);
  if (!info) throw new Error(`Tabla desconocida: ${table}`);
  return info;
}

/** Tablas y columnas que espera el esquema (para verificar la D1 desplegada). */
export function expectedSchema(): Map<string, string[]> {
  tableInfo('pos_products');
  return new Map([...tables!].map(([name, info]) => [name, [...info.columns]]));
}

function checkColumn(table: string, column: string) {
  if (!tableInfo(table).columns.has(column)) throw new Error(`Columna desconocida: ${table}.${column}`);
}

/** Fecha en el formato que guarda Prisma en D1 (las comparaciones son de texto). */
export function toDbDate(d: Date): string {
  return d.toISOString().replace('Z', '+00:00');
}

function toDb(v: BatchValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return toDbDate(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

/** Id nuevo para un registro (texto unico, como el cuid() de Prisma). */
export function newId(): string {
  return 'c' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

function isIncrement(v: unknown): v is Increment {
  return typeof v === 'object' && v !== null && !(v instanceof Date) && ('increment' in v || 'decrement' in v);
}

/** Lote de escrituras de un negocio que se aplica completo o no se aplica. */
export class D1Batch {
  private statements: D1PreparedStatement[] = [];

  constructor(private d1: D1Database, private tenantId: string) {
    if (!d1) throw new Error('Base de datos D1 no disponible');
  }

  /** INSERT. Completa id, tenant_id y las fechas "ahora" (createdAt, updatedAt, date...) si faltan. Devuelve el id. */
  insert(table: string, row: Record<string, BatchValue | SqlExpr>): string {
    const { nowColumns } = tableInfo(table);
    const now = toDbDate(new Date());
    const id = typeof row.id === 'string' ? row.id : newId();
    const data: Record<string, BatchValue | SqlExpr> = { ...row, id, tenant_id: this.tenantId };
    for (const col of nowColumns) if (data[col] === undefined) data[col] = now;
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    keys.forEach((k) => checkColumn(table, k));
    const placeholders: string[] = [];
    const params: (string | number | null)[] = [];
    for (const k of keys) {
      const v = data[k];
      if (v instanceof SqlExpr) {
        placeholders.push(`(${v.sql})`);
        params.push(...v.params.map(toDb));
      } else {
        placeholders.push('?');
        params.push(toDb(v as BatchValue));
      }
    }
    const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')})`;
    this.statements.push(this.d1.prepare(sql).bind(...params));
    return id;
  }

  /**
   * UPDATE de un registro del negocio. Acepta { increment } / { decrement }, que se
   * calculan en la base de datos (dos ventas simultaneas no se pisan el stock).
   */
  update(table: string, id: string, set: Record<string, BatchValue | Increment>): void {
    const { columns } = tableInfo(table);
    const data: Record<string, BatchValue | Increment> = { ...set };
    delete data.id;
    delete data.tenant_id;
    if (columns.has('updatedAt') && data.updatedAt === undefined) data.updatedAt = new Date();
    const parts: string[] = [];
    const params: (string | number | null)[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      checkColumn(table, k);
      if (isIncrement(v)) {
        const delta = 'increment' in v ? v.increment : -v.decrement;
        parts.push(`"${k}" = "${k}" + ?`);
        params.push(Number(delta) || 0);
      } else {
        parts.push(`"${k}" = ?`);
        params.push(toDb(v));
      }
    }
    if (parts.length === 0) return;
    const sql = `UPDATE "${table}" SET ${parts.join(', ')} WHERE "id" = ? AND "tenant_id" = ?`;
    this.statements.push(this.d1.prepare(sql).bind(...params, id, this.tenantId));
  }

  /** DELETE de un registro del negocio. */
  delete(table: string, id: string): void {
    tableInfo(table);
    this.statements.push(this.d1.prepare(`DELETE FROM "${table}" WHERE "id" = ? AND "tenant_id" = ?`).bind(id, this.tenantId));
  }

  /**
   * Sentencia libre para lo que update() no cubre (p. ej. MAX(0, saldo - ?)).
   * Debe filtrar por tenant_id: el tenant_id del negocio se agrega al final de los parametros.
   */
  raw(sql: string, ...params: BatchValue[]): void {
    if (!/"tenant_id"\s*=\s*\?/.test(sql)) throw new Error('La sentencia debe filtrar por "tenant_id" = ?');
    this.statements.push(this.d1.prepare(sql).bind(...params.map(toDb), this.tenantId));
  }

  get size(): number {
    return this.statements.length;
  }

  /** Ejecuta todo el lote en una sola transaccion de D1. */
  async commit(): Promise<void> {
    if (this.statements.length === 0) return;
    await this.d1.batch(this.statements);
  }
}
