// Lecturas con SQL directo sobre D1, sin Prisma, con el mismo formato que devuelve Prisma
// (ver fromDbRow). En el plan Free de Workers cada request tiene 10 ms de CPU y arrancar
// Prisma cuesta decenas: las rutas que mas se usan leen asi (ver "Limite de CPU" en CLAUDE.md).
//
// Sin la extension de Prisma no hay aislamiento automatico: toda consulta filtra
// "tenant_id" = ? a mano.
import { fromDbRow } from './d1-batch';

export function d1Of(env: any): D1Database {
  return env.DB as D1Database;
}

/** Filas de una tabla (SELECT * ...) convertidas al formato de Prisma. */
export async function selectRows<T = any>(D1: D1Database, table: string, sql: string, ...params: unknown[]): Promise<T[]> {
  const { results } = await D1.prepare(sql).bind(...params).all();
  return ((results || []) as any[]).map((r) => fromDbRow<T>(table, r) as T);
}

/** Primera fila de una tabla (o null), en el formato de Prisma. */
export async function selectRow<T = any>(D1: D1Database, table: string, sql: string, ...params: unknown[]): Promise<T | null> {
  return fromDbRow<T>(table, await D1.prepare(sql).bind(...params).first());
}

/** "?, ?, ?" para un IN (...) con n valores. */
export function placeholders(n: number, from = 1): string {
  return Array.from({ length: n }, (_, i) => `?${from + i}`).join(', ');
}

/**
 * Productos del negocio por id (mapa) y su ultimo movimiento de kardex, en un solo lote.
 * `moveOrder` es la columna para elegir el ultimo movimiento (createdAt o date).
 */
export async function loadProductsWithLastMove(
  D1: D1Database, tenantId: string, productIds: string[], moveOrder: 'createdAt' | 'date' = 'createdAt',
): Promise<{ products: Map<string, any>; lastMoves: Map<string, any> }> {
  const ids = [...new Set(productIds.filter(Boolean))];
  const products = new Map<string, any>();
  const lastMoves = new Map<string, any>();
  if (ids.length === 0) return { products, lastMoves };
  const stmts = [
    D1.prepare(`SELECT * FROM pos_products WHERE tenant_id = ?1 AND id IN (${placeholders(ids.length, 2)})`).bind(tenantId, ...ids),
    ...ids.map((id) => D1.prepare(
      `SELECT * FROM pos_inventory_movements WHERE tenant_id = ?1 AND productId = ?2 ORDER BY "${moveOrder}" DESC LIMIT 1`,
    ).bind(tenantId, id)),
  ];
  const [prodRes, ...moveRes] = await D1.batch(stmts);
  for (const r of (prodRes.results || []) as any[]) products.set(r.id, fromDbRow('pos_products', r));
  ids.forEach((id, i) => {
    const m = (moveRes[i].results || [])[0];
    if (m) lastMoves.set(id, fromDbRow('pos_inventory_movements', m as any));
  });
  return { products, lastMoves };
}
