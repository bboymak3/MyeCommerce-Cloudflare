export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow, toDbDate } from '@/lib/d1-batch';
import { d1Of, loadProductsWithLastMove, placeholders } from '@/lib/d1-read';
import { veDayStart, veDayEnd } from '@/lib/ve-time';

// Sin Prisma: lecturas con SQL directo (ver "Limite de CPU" en CLAUDE.md)

/** Filas de `table` cuyo `fk` esta en `ids`, agrupadas por ese campo (formato Prisma). */
async function childrenBy(D1: D1Database, tenantId: string, table: string, fk: string, ids: string[]) {
  const out = new Map<string, any[]>();
  if (ids.length === 0) return out;
  const { results } = await D1.prepare(`SELECT * FROM "${table}" WHERE tenant_id = ?1 AND "${fk}" IN (${placeholders(ids.length, 2)}) ORDER BY rowid`)
    .bind(tenantId, ...ids).all();
  for (const r of (results || []) as any[]) {
    if (!out.has(r[fk])) out.set(r[fk], []);
    out.get(r[fk])!.push(fromDbRow(table, r));
  }
  return out;
}

/** Productos completos por id (formato Prisma). */
async function productsById(D1: D1Database, tenantId: string, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, any>();
  if (uniq.length === 0) return out;
  const { results } = await D1.prepare(`SELECT * FROM pos_products WHERE tenant_id = ?1 AND id IN (${placeholders(uniq.length, 2)})`)
    .bind(tenantId, ...uniq).all();
  for (const r of (results || []) as any[]) out.set(r.id, fromDbRow('pos_products', r));
  return out;
}

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 1000);

    // Devoluciones con su venta (y los items de la venta) y sus items (con el producto)
    const range = startDate && endDate;
    const { results } = await D1.prepare(
      `SELECT * FROM pos_devolutions WHERE tenant_id = ?1 ${range ? 'AND date >= ?3 AND date <= ?4' : ''} ORDER BY date DESC LIMIT ?2`,
    ).bind(tenantId, limit, ...(range ? [toDbDate(veDayStart(startDate)), toDbDate(veDayEnd(endDate))] : [])).all();
    const devs = ((results || []) as any[]).map((r) => fromDbRow<any>('pos_devolutions', r));
    const saleIds = [...new Set(devs.map((d) => d.saleId))];
    const [salesRes, devItems, saleItems] = await Promise.all([
      saleIds.length
        ? D1.prepare(`SELECT * FROM pos_sales WHERE tenant_id = ?1 AND id IN (${placeholders(saleIds.length, 2)})`).bind(tenantId, ...saleIds).all()
        : Promise.resolve({ results: [] as any[] }),
      childrenBy(D1, tenantId, 'pos_devolution_items', 'devolutionId', devs.map((d) => d.id)),
      childrenBy(D1, tenantId, 'pos_sale_items', 'saleId', saleIds),
    ]);
    const sales = new Map(((salesRes.results || []) as any[]).map((r) => [r.id, fromDbRow<any>('pos_sales', r)]));
    const allItems = [...devItems.values()].flat();
    const products = await productsById(D1, tenantId, allItems.map((i) => i.productId));
    const devolutions = devs.map((d) => {
      const sale = sales.get(d.saleId);
      return {
        ...d,
        sale: sale ? { ...sale, items: saleItems.get(d.saleId) || [] } : null,
        items: (devItems.get(d.id) || []).map((i) => ({ ...i, product: products.get(i.productId) || null })),
      };
    });
    return NextResponse.json(devolutions);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener devoluciones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;

    if (!body.saleId) {
      return NextResponse.json({ error: 'Venta requerida' }, { status: 400 });
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items de devolucion son requeridos' }, { status: 400 });
    }

    // Validar que la venta existe
    // Las devoluciones previas con sus items: sin ellos no se puede saber cuanto ya se devolvio
    const saleRow: any = fromDbRow('pos_sales', await D1.prepare('SELECT * FROM pos_sales WHERE tenant_id = ?1 AND id = ?2')
      .bind(tenantId, String(body.saleId)).first());
    let sale: any = null;
    if (saleRow) {
      const { results: prevDevs } = await D1.prepare('SELECT id FROM pos_devolutions WHERE tenant_id = ?1 AND saleId = ?2').bind(tenantId, saleRow.id).all();
      const prevIds = ((prevDevs || []) as any[]).map((d) => d.id);
      const [items, prevItems] = await Promise.all([
        childrenBy(D1, tenantId, 'pos_sale_items', 'saleId', [saleRow.id]),
        childrenBy(D1, tenantId, 'pos_devolution_items', 'devolutionId', prevIds),
      ]);
      const saleItemList = items.get(saleRow.id) || [];
      const names = await productsById(D1, tenantId, saleItemList.map((i) => i.productId));
      sale = {
        ...saleRow,
        items: saleItemList.map((i) => ({ ...i, product: names.has(i.productId) ? { name: names.get(i.productId).name } : null })),
        devolutions: prevIds.map((id) => ({ id, items: prevItems.get(id) || [] })),
      };
    }

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    // Verificar cantidades devueltas no excedan lo vendido
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: `Cantidad invalida para "${item.productName || item.productId}"` }, { status: 400 });
      }
      const saleItem = sale.items.find((si: any) => si.productId === item.productId);
      if (!saleItem) {
        return NextResponse.json(
          { error: `Producto ${item.productName || item.productId} no estaba en esta venta` },
          { status: 400 }
        );
      }
      // Calculate total already returned for this product
      const alreadyReturned = sale.devolutions
        .flatMap((d: any) => d.items || [])
        .filter((di: any) => di.productId === item.productId)
        .reduce((sum: number, di: any) => sum + di.quantity, 0);
      const maxReturnable = saleItem.quantity - alreadyReturned;
      if (qty > maxReturnable) {
        return NextResponse.json(
          { error: `No se puede devolver ${qty} unidades de "${item.productName || item.productId}". Maximo devoluble: ${maxReturnable}` },
          { status: 400 }
        );
      }
    }

    const settings: any = await D1.prepare('SELECT bcvRate FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId).first();
    const rate = settings?.bcvRate || 36.50;
    const { products, lastMoves } = await loadProductsWithLastMove(D1, tenantId, body.items.map((i: any) => String(i.productId || '')));

    const totalUsd = body.items.reduce((sum: number, item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (qty * unitPrice);
    }, 0);

    // Escrituras en un lote atomico de D1: devolucion, items, stock y kardex
    const batch = new D1Batch(D1, tenantId);
    const now = new Date();
    const devolutionId = batch.insert('pos_devolutions', {
      saleId: body.saleId,
      date: now,
      reason: body.reason || 'Devolucion',
      totalUsd,
      totalBs: totalUsd * rate,
      exchangeRate: rate,
      status: body.status || 'completada',
    });
    // Calcular total server-side por cada item (no confiar en el cliente)
    for (const item of body.items) {
      const qty = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      batch.insert('pos_devolution_items', {
        devolutionId,
        productId: item.productId,
        productName: item.productName || sale.items.find((si: any) => si.productId === item.productId)?.product?.name || '',
        quantity: qty,
        unitPrice,
        total: qty * unitPrice,
      });
    }

    // Venta a credito: lo devuelto se descuenta de lo que el cliente debe (hasta su saldo
    // pendiente) y queda en su historial de abonos con metodo 'devolucion'.
    if (sale.isCredit) {
      const pending = Number(sale.total || 0) - Number(sale.creditPaid || 0);
      const debtCut = Number(Math.min(totalUsd, pending).toFixed(2));
      if (debtCut > 0) {
        batch.insert('pos_credit_payments', {
          saleId: body.saleId,
          clientId: sale.clientId || null,
          date: now,
          amount: debtCut,
          exchangeRate: rate,
          amountBs: Number((debtCut * rate).toFixed(2)),
          method: 'devolucion',
          reference: devolutionId,
          notes: body.reason || 'Devolucion',
          createdBy: req.headers.get('x-username') || '',
        });
        batch.raw('UPDATE "pos_sales" SET "creditPaid" = ROUND(MIN("total", "creditPaid" + ?), 2) WHERE "id" = ? AND "tenant_id" = ?', debtCut, body.saleId);
        if (sale.clientId) {
          batch.raw('UPDATE "pos_clients" SET "creditBalance" = MAX(0, ROUND("creditBalance" - ?, 2)), "updatedAt" = ? WHERE "id" = ? AND "tenant_id" = ?', debtCut, now, sale.clientId);
        }
      }
    }

    // Restaurar stock y registrar la entrada en el kardex
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      const product = products.get(item.productId);
      const lastMove = lastMoves.get(item.productId);
      const unitCost = product?.cost || 0;
      const prevQty = product?.stock ?? 0;
      const prevTC = lastMove && lastMove.balanceQty > 0 ? (lastMove.balanceTotalCost / lastMove.balanceQty) * prevQty : prevQty * unitCost;
      const balQty = prevQty + qty;
      const balTC = prevTC + qty * unitCost;
      batch.update('pos_products', item.productId, { stock: { increment: qty } });
      batch.insert('pos_inventory_movements', {
        productId: item.productId, date: now, movementType: 'devolucion',
        concept: `Devolucion venta ${sale.invoiceNumber || ''}`.trim(),
        quantity: qty, absQuantity: qty, unitCost, totalCost: qty * unitCost,
        balanceQty: balQty, balanceTotalCost: balTC, balanceAvgCost: balQty > 0 ? balTC / balQty : 0,
        userId: req.headers.get('x-user-id') || '', userName: req.headers.get('x-username') || '',
        userRole: req.headers.get('x-user-role') || '', referenceId: body.saleId,
      });
    }

    await batch.commit();
    const devolution: any = fromDbRow('pos_devolutions', await D1.prepare('SELECT * FROM pos_devolutions WHERE tenant_id = ?1 AND id = ?2')
      .bind(tenantId, devolutionId).first());
    if (devolution) {
      devolution.items = (await childrenBy(D1, tenantId, 'pos_devolution_items', 'devolutionId', [devolutionId])).get(devolutionId) || [];
      devolution.sale = fromDbRow('pos_sales', await D1.prepare('SELECT * FROM pos_sales WHERE tenant_id = ?1 AND id = ?2')
        .bind(tenantId, String(body.saleId)).first());
    }

    return NextResponse.json(devolution);
  } catch (error) {
    console.error('Error creating devolution:', error);
    return NextResponse.json({ error: 'Error al registrar devolucion' }, { status: 500 });
  }
}
