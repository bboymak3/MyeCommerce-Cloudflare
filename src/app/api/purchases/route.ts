export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow, toDbDate } from '@/lib/d1-batch';
import { d1Of, loadProductsWithLastMove, placeholders } from '@/lib/d1-read';
import { veDayStart, veDayEnd } from '@/lib/ve-time';

// Sin Prisma: lecturas con SQL directo (ver "Limite de CPU" en CLAUDE.md)

/** Compras con sus items y proveedor, en el formato que devolvia Prisma. */
async function loadPurchasesSql(D1: D1Database, tenantId: string, where: string, params: unknown[], fullSupplier: boolean) {
  const { results } = await D1.prepare(`SELECT * FROM pos_purchases WHERE tenant_id = ?1 ${where} ORDER BY date DESC`).bind(tenantId, ...params).all();
  const purchases = ((results || []) as any[]).map((r) => fromDbRow<any>('pos_purchases', r));
  if (purchases.length === 0) return [];
  const ids = purchases.map((p) => p.id);
  const supplierIds = [...new Set(purchases.map((p) => p.supplierId).filter(Boolean))] as string[];
  const [itemsRes, supRes] = await D1.batch([
    D1.prepare(`SELECT * FROM pos_purchase_items WHERE tenant_id = ?1 AND purchaseId IN (${placeholders(ids.length, 2)}) ORDER BY rowid`).bind(tenantId, ...ids),
    D1.prepare(`SELECT * FROM pos_suppliers WHERE tenant_id = ?1 AND id IN (${placeholders(Math.max(1, supplierIds.length), 2)})`).bind(tenantId, ...(supplierIds.length ? supplierIds : [''])),
  ]);
  const items = new Map<string, any[]>();
  for (const it of (itemsRes.results || []) as any[]) {
    if (!items.has(it.purchaseId)) items.set(it.purchaseId, []);
    items.get(it.purchaseId)!.push(fromDbRow('pos_purchase_items', it));
  }
  const suppliers = new Map(((supRes.results || []) as any[]).map((r) => {
    const full: any = fromDbRow('pos_suppliers', r);
    return [r.id, fullSupplier ? full : { id: full.id, name: full.name, rif: full.rif }];
  }));
  return purchases.map((p) => ({ ...p, items: items.get(p.id) || [], supplier: (p.supplierId && suppliers.get(p.supplierId)) || null }));
}

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const supplierId = searchParams.get('supplierId');

    const conds: string[] = [];
    const params: unknown[] = [];
    if (startDate && endDate) {
      params.push(toDbDate(veDayStart(startDate)), toDbDate(veDayEnd(endDate)));
      conds.push(`AND date >= ?${params.length + 0} AND date <= ?${params.length + 1}`);
    }
    if (supplierId) { params.push(supplierId); conds.push(`AND supplierId = ?${params.length + 1}`); }
    const purchases = await loadPurchasesSql(d1Of(env), tenantId, conds.join(' '), params, false);
    return NextResponse.json(purchases);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener compras' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items de compra son requeridos' }, { status: 400 });
    }
    const settings: any = fromDbRow('pos_settings', await D1.prepare('SELECT * FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId).first());
    const { products, lastMoves } = await loadProductsWithLastMove(D1, tenantId, body.items.map((i: any) => String(i.productId || '')));
    const exchangeRate = parseFloat(body.exchangeRate) || settings?.bcvRate || 36.5;

    // Calculate total from items
    const itemsTotal = body.items.reduce((sum: number, item: any) => {
      if (item.isBox) {
        // Compra por bulto: total = boxQty * boxCost
        return sum + (parseFloat(item.boxQty || 0) * parseFloat(item.boxCost || 0));
      }
      return sum + (parseFloat(item.unitCost || 0) * parseFloat(item.quantity || 0));
    }, 0);

    // D1 BATCH TRANSACTION: all reads BEFORE transaction, then all writes as a batch

    // Read product data and last inventory movements for kardex — READS FIRST
    const pDate = body.date ? new Date(body.date) : new Date();
    const pUser = req.headers.get('x-username') || '';
    const pRole = req.headers.get('x-user-role') || '';
    const pUserId = req.headers.get('x-user-id') || '';
    const kardexData: { productId: string; qty: number; unitCost: number; entryTotalCost: number; balQty: number; balTC: number; balAvg: number }[] = [];
    for (const item of body.items) {
      if (!item.productId) continue;
      const qty = item.isBox ? (parseFloat(item.boxQty || 0) * parseFloat(item.unitsPerBox || 0)) : parseFloat(item.quantity || 0);
      if (qty <= 0) continue;
      const unitCost = item.isBox ? parseFloat(item.calcUnitCost || 0) : parseFloat(item.unitCost || 0);
      const product = products.get(item.productId);
      const lastMove = lastMoves.get(item.productId);
      // Saldo anterior = stock real antes de sumar la compra
      const prevQty = product?.stock ?? lastMove?.balanceQty ?? 0;
      const prevTC = lastMove?.balanceTotalCost ?? (prevQty * (product?.cost || unitCost));
      const entryTotalCost = qty * unitCost;
      const balQty = prevQty + qty;
      const balTC = prevTC + entryTotalCost;
      const balAvg = balQty > 0 ? balTC / balQty : unitCost;
      kardexData.push({ productId: item.productId, qty, unitCost, entryTotalCost, balQty, balTC, balAvg });
    }

    // Build batch write operations
    const isCredit = body.isCredit === true && !!body.supplierId;
    const dueDate = isCredit ? (() => { const d = new Date(); d.setDate(d.getDate() + (parseInt(body.creditDays) || 30)); return d; })() : null;

    // Escrituras en un lote atomico de D1: compra, items, stock/costos, kardex y deuda
    const batch = new D1Batch((env as any).DB, tenantId);
    const purchaseId = batch.insert('pos_purchases', {
      date: pDate,
      number: body.number || '',
      supplierId: body.supplierId || null,
      totalUsd: parseFloat(itemsTotal.toFixed(2)),
      totalBs: parseFloat((itemsTotal * exchangeRate).toFixed(2)),
      exchangeRate,
      notes: body.notes || '',
      isCredit,
      dueDate,
    });
    for (const item of body.items) {
      if (item.isBox) {
        // Compra por bulto
        const boxQty = parseFloat(item.boxQty || 0);
        const unitsPerBox = parseFloat(item.unitsPerBox || 0);
        const boxCost = parseFloat(item.boxCost || 0);
        const totalUnits = boxQty * unitsPerBox;
        const calcUnitCost = unitsPerBox > 0 ? boxCost / unitsPerBox : 0;
        const calcMargin = parseFloat(item.calcMargin || 0);
        const calcPrice = calcUnitCost > 0 && calcMargin > 0
          ? calcUnitCost / (1 - calcMargin / 100)
          : 0;
        batch.insert('pos_purchase_items', {
          purchaseId,
          productId: item.productId || null,
          productName: item.productName || '',
          quantity: totalUnits,
          unitCost: parseFloat(calcUnitCost.toFixed(4)),
          total: parseFloat((boxQty * boxCost).toFixed(2)),
          isBox: true,
          unitsPerBox,
          boxQty,
          boxCost,
          calcUnitCost: parseFloat(calcUnitCost.toFixed(4)),
          calcMargin,
          calcPrice: parseFloat(calcPrice.toFixed(2)),
        });
      } else {
        // Compra por unidad (normal)
        const qty = parseFloat(item.quantity || 0);
        const cost = parseFloat(item.unitCost || 0);
        batch.insert('pos_purchase_items', {
          purchaseId,
          productId: item.productId || null,
          productName: item.productName || '',
          quantity: qty,
          unitCost: cost,
          total: parseFloat((qty * cost).toFixed(2)),
          isBox: false,
        });
      }
    }

    // Auto-update product stock, cost, and optionally price
    for (const item of body.items) {
      if (!item.productId) continue;
      if (item.isBox) {
        const boxQty = parseFloat(item.boxQty || 0);
        const unitsPerBox = parseFloat(item.unitsPerBox || 0);
        const boxCost = parseFloat(item.boxCost || 0);
        const totalUnits = boxQty * unitsPerBox;
        const calcUnitCost = unitsPerBox > 0 ? boxCost / unitsPerBox : 0;
        const calcMargin = parseFloat(item.calcMargin || 0);
        const calcPrice = calcUnitCost > 0 && calcMargin >= 0
          ? calcUnitCost * (1 + calcMargin / 100) : 0;

        const updateData: Record<string, any> = {
          stock: { increment: totalUnits },
          cost: parseFloat(calcUnitCost.toFixed(4)),
        };
        // Si se calculo precio de venta, actualizarlo tambien
        if (calcPrice > 0) {
          updateData.price = parseFloat(calcPrice.toFixed(2));
          updateData.marginPercent = calcMargin;
        }
        // Actualizar unidades por caja si el producto tiene ese campo
        if (unitsPerBox > 0) {
          updateData.unitsPerBox = unitsPerBox;
          updateData.boxPrice = boxCost;
        }
        batch.update('pos_products', item.productId, updateData);
      } else {
        batch.update('pos_products', item.productId, {
          stock: { increment: parseFloat(item.quantity || 0) },
          ...(item.unitCost ? { cost: parseFloat(item.unitCost) } : {}),
        });
      }
    }

    // Kardex (compra = entrada)
    for (const kd of kardexData) {
      batch.insert('pos_inventory_movements', {
        productId: kd.productId, date: pDate, movementType: 'compra', concept: `Compra ${body.number || ''}`,
        quantity: kd.qty, absQuantity: kd.qty, unitCost: kd.unitCost, totalCost: kd.entryTotalCost,
        balanceQty: kd.balQty, balanceTotalCost: kd.balTC, balanceAvgCost: kd.balAvg,
        userId: String(pUserId), userName: pUser, userRole: pRole, referenceId: purchaseId,
      });
    }

    // Compra a credito: aumenta la deuda con el proveedor
    if (isCredit && body.supplierId) {
      batch.update('pos_suppliers', body.supplierId, { payableBalance: { increment: parseFloat(itemsTotal.toFixed(2)) } });
    }

    await batch.commit();
    const [purchase] = await loadPurchasesSql(D1, tenantId, 'AND id = ?2', [purchaseId], true);

    return NextResponse.json(purchase || null);
  } catch (error: any) {
    console.error('Error creating purchase:', error);
    return NextResponse.json({ error: 'Error al registrar compra: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // D1 BATCH TRANSACTION: reads first, then batch writes
    const [purchase] = await loadPurchasesSql(D1, tenantId, 'AND id = ?2', [id], false);
    if (purchase) {
      const { products } = await loadProductsWithLastMove(D1, tenantId, purchase.items.map((i: any) => String(i.productId || '')));
      const batch = new D1Batch(D1, tenantId);
      for (const item of purchase.items) {
        if (item.productId) {
          const product = products.get(item.productId);
          if (product && product.stock >= item.quantity) {
            batch.update('pos_products', item.productId, { stock: { decrement: item.quantity } });
          }
        }
      }
      batch.delete('pos_purchases', id);
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar compra' }, { status: 500 });
  }
}
