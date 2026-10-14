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

/**
 * Ventas del negocio (formato Prisma, mas recientes primero) con sus items y, en cada item,
 * las columnas pedidas del producto: lo mismo que
 * `findMany({ include: { items: { include: { product: { select } } } } })`.
 * `where` es SQL extra sobre pos_sales (alias s) con parametros desde ?2.
 */
export async function loadSalesWithItems(
  D1: D1Database, tenantId: string, where: string, params: unknown[], productCols: string[], orderBy = 's.date DESC',
): Promise<any[]> {
  const { results } = await D1.prepare(`SELECT s.* FROM pos_sales s WHERE s.tenant_id = ?1 ${where} ORDER BY ${orderBy}`)
    .bind(tenantId, ...params).all();
  const sales = ((results || []) as any[]).map((r) => fromDbRow<any>('pos_sales', r));
  if (sales.length === 0) return [];
  const cols = productCols.map((c) => `p."${c}" AS "_p_${c}"`).join(', ');
  // Items de esas ventas: mismo filtro sobre la venta (evita un IN con miles de ids)
  const { results: itemRows } = await D1.prepare(
    `SELECT si.*, p.id AS _p__exists${cols ? ', ' + cols : ''}
     FROM pos_sale_items si
     JOIN pos_sales s ON s.id = si.saleId AND s.tenant_id = ?1
     LEFT JOIN pos_products p ON p.id = si.productId
     WHERE si.tenant_id = ?1 ${where} ORDER BY si.rowid`,
  ).bind(tenantId, ...params).all();
  const items = new Map<string, any[]>();
  for (const r of (itemRows || []) as any[]) {
    const item: any = {};
    const product: any = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === '_p__exists') continue;
      if (k.startsWith('_p_')) product[k.slice(3)] = v;
      else item[k] = v;
    }
    const row = { ...fromDbRow('pos_sale_items', item), product: r._p__exists ? fromDbRow('pos_products', product) : null };
    if (!items.has(r.saleId)) items.set(r.saleId, []);
    items.get(r.saleId)!.push(row);
  }
  return sales.map((x) => ({ ...x, items: items.get(x.id) || [] }));
}
