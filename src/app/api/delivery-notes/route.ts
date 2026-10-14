export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow, sqlExpr, toDbDate } from '@/lib/d1-batch';
import { d1Of, loadProductsWithLastMove, placeholders } from '@/lib/d1-read';
import { veDayStart, veDayEnd } from '@/lib/ve-time';

// Sin Prisma: lecturas con SQL directo (ver "Limite de CPU" en CLAUDE.md)

/** Notas de entrega con sus items, en el formato que devolvia Prisma (include: { items: true }). */
async function loadNotesSql(D1: D1Database, tenantId: string, where: string, params: unknown[]) {
  const { results } = await D1.prepare(`SELECT * FROM pos_delivery_notes WHERE tenant_id = ?1 ${where} ORDER BY createdAt DESC`)
    .bind(tenantId, ...params).all();
  const notes = ((results || []) as any[]).map((r) => fromDbRow<any>('pos_delivery_notes', r));
  if (notes.length === 0) return [];
  const ids = notes.map((n) => n.id);
  const { results: itemRows } = await D1.prepare(
    `SELECT * FROM pos_delivery_note_items WHERE tenant_id = ?1 AND deliveryNoteId IN (${placeholders(ids.length, 2)}) ORDER BY rowid`,
  ).bind(tenantId, ...ids).all();
  const items = new Map<string, any[]>();
  for (const it of (itemRows || []) as any[]) {
    if (!items.has(it.deliveryNoteId)) items.set(it.deliveryNoteId, []);
    items.get(it.deliveryNoteId)!.push(fromDbRow('pos_delivery_note_items', it));
  }
  return notes.map((n) => ({ ...n, items: items.get(n.id) || [] }));
}

async function loadNoteSql(D1: D1Database, tenantId: string, id: string) {
  const [note] = await loadNotesSql(D1, tenantId, 'AND id = ?2', [id]);
  return note || null;
}

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const conds: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); conds.push(sql.replace('?', `?${params.length + 1}`)); };
    if (status) add('AND status = ?', status);
    if (userId) add('AND userId = ?', userId);
    if (startDate) add('AND createdAt >= ?', toDbDate(veDayStart(startDate)));
    if (endDate) add('AND createdAt <= ?', toDbDate(veDayEnd(endDate)));

    const deliveryNotes = await loadNotesSql(d1Of(env), tenantId, conds.join(' '), params);

    return NextResponse.json(deliveryNotes);
  } catch (error) {
    console.error('Error fetching delivery notes:', error);
    return NextResponse.json({ error: 'Error al obtener notas de entrega' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items son requeridos' }, { status: 400 });
    }

    const exchangeRate = sf(body.exchangeRate);
    const userId = body.userId || '';
    const userName = body.userName || '';
    const userRole = req.headers.get('x-user-role') || '';

    // El numero correlativo lo calcula D1 dentro del lote (como la factura): dos notas
    // simultaneas nunca reciben el mismo
    const nextNumber = sqlExpr('SELECT COALESCE(MAX("number"), 0) + 1 FROM "pos_delivery_notes" WHERE "tenant_id" = ?', tenantId);
    const { products, lastMoves } = await loadProductsWithLastMove(D1, tenantId, body.items.map((i: any) => String(i.productId || '')), 'date');

    // D1 BATCH TRANSACTION: reads first, then batch writes
    // Pre-read all products and last movements for each item
    const itemData: { productId: string; quantity: number; newStock: number; unitCost: number; totalCost: number; newBalanceQty: number; newBalanceTotalCost: number; newAvgCost: number; productName: string }[] = [];
    let totalUsd = 0;
    for (const item of body.items) {
      const productId = item.productId;
      const quantity = sf(item.quantity);
      if (quantity <= 0 || !productId) continue;

      const product = products.get(productId);
      if (!product) continue;

      const lastMovement = lastMoves.get(productId);

      // Saldo anterior = stock real (antes solo se usaba el ultimo movimiento, o 0 si no habia)
      const prevBalanceQty = sf(product.stock);
      const prevBalanceTotalCost = lastMovement && lastMovement.balanceQty > 0
        ? (lastMovement.balanceTotalCost / lastMovement.balanceQty) * prevBalanceQty
        : prevBalanceQty * sf(product.cost);
      const avgCost = prevBalanceQty > 0 ? prevBalanceTotalCost / prevBalanceQty : sf(product.cost);

      const unitCost = avgCost;
      const totalCost = parseFloat((quantity * unitCost).toFixed(4));
      const newStock = parseFloat((product.stock - quantity).toFixed(4));

      const newBalanceQty = parseFloat((prevBalanceQty - quantity).toFixed(4));
      const newBalanceTotalCost = parseFloat((prevBalanceTotalCost - totalCost).toFixed(4));
      const newAvgCost = newBalanceQty > 0
        ? parseFloat((newBalanceTotalCost / newBalanceQty).toFixed(4))
        : 0;

      totalUsd += totalCost;
      itemData.push({ productId, quantity, newStock, unitCost, totalCost, newBalanceQty, newBalanceTotalCost, newAvgCost, productName: item.productName || '' });
    }

    const totalBs = parseFloat((totalUsd * exchangeRate).toFixed(2));

    // Escrituras en un lote atomico de D1: nota, items, stock y kardex
    const batch = new D1Batch(D1, tenantId);
    const noteId = batch.insert('pos_delivery_notes', {
      number: nextNumber,
      userId,
      userName,
      recipientName: body.recipientName || '',
      recipientDoc: body.recipientDoc || '',
      recipientAddr: body.recipientAddr || '',
      reason: body.reason || '',
      notes: body.notes || '',
      totalUsd: parseFloat(totalUsd.toFixed(2)),
      totalBs,
      exchangeRate,
      status: 'emitida',
    });
    for (const d of itemData) {
      batch.insert('pos_delivery_note_items', {
        deliveryNoteId: noteId,
        productId: d.productId,
        productName: d.productName,
        quantity: d.quantity,
        unitCost: parseFloat(d.unitCost.toFixed(4)),
        totalCost: d.totalCost,
      });
      // Descuento calculado en la base de datos (no pisa ventas simultaneas)
      batch.update('pos_products', d.productId, { stock: { decrement: d.quantity } });
      batch.insert('pos_inventory_movements', {
        productId: d.productId,
        movementType: 'nota_entrega',
        concept: sqlExpr(`SELECT 'Nota de entrega #' || "number" FROM "pos_delivery_notes" WHERE "id" = ?`, noteId),
        quantity: -d.quantity,
        absQuantity: d.quantity,
        unitCost: parseFloat(d.unitCost.toFixed(4)),
        totalCost: d.totalCost,
        balanceQty: d.newBalanceQty,
        balanceTotalCost: d.newBalanceTotalCost,
        balanceAvgCost: d.newAvgCost,
        userId,
        userName,
        userRole,
        referenceId: noteId,
      });
    }
    await batch.commit();
    const deliveryNote = await loadNoteSql(D1, tenantId, noteId);

    return NextResponse.json(deliveryNote, { status: 201 });
  } catch (error: any) {
    console.error('Error creating delivery note:', error);
    return NextResponse.json({ error: 'Error al crear nota de entrega: ' + (error.message || '') }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;

    if (!body.id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    if (!['recibida', 'anulada'].includes(body.status)) {
      return NextResponse.json({ error: 'Estado invalido. Use "recibida" o "anulada"' }, { status: 400 });
    }

    const existing = await loadNoteSql(D1, tenantId, String(body.id));

    if (!existing) {
      return NextResponse.json({ error: 'Nota de entrega no encontrada' }, { status: 404 });
    }

    if (existing.status !== 'emitida') {
      return NextResponse.json({ error: 'Solo se pueden modificar notas en estado "emitida"' }, { status: 400 });
    }

    const userId = req.headers.get('x-user-id') || '';
    const userName = req.headers.get('x-username') || '';
    const userRole = req.headers.get('x-user-role') || '';

    // If anulada, restore stock and create compensating inventory movements
    if (body.status === 'anulada') {
      // D1 BATCH TRANSACTION: reads first, then batch writes
      // Pre-read all products and last movements for each item
      const anularData: { productId: string; quantity: number; newStock: number; unitCost: number; totalCost: number; newBalanceQty: number; newBalanceTotalCost: number; newAvgCost: number }[] = [];
      const { products, lastMoves } = await loadProductsWithLastMove(D1, tenantId, existing.items.map((i: any) => String(i.productId || '')), 'date');
      for (const item of existing.items) {
        const quantity = item.quantity;
        if (quantity <= 0) continue;

        const product = products.get(item.productId);
        if (!product) continue;

        const newStock = parseFloat((product.stock + quantity).toFixed(4));

        const lastMovement = lastMoves.get(item.productId);

        const prevBalanceQty = lastMovement ? lastMovement.balanceQty : 0;
        const prevBalanceTotalCost = lastMovement ? lastMovement.balanceTotalCost : 0;
        const avgCost = item.unitCost > 0 ? item.unitCost : (prevBalanceQty > 0 ? prevBalanceTotalCost / prevBalanceQty : 0);

        const unitCost = avgCost;
        const totalCost = parseFloat((quantity * unitCost).toFixed(4));

        const newBalanceQty = parseFloat((prevBalanceQty + quantity).toFixed(4));
        const newBalanceTotalCost = parseFloat((prevBalanceTotalCost + totalCost).toFixed(4));
        const newAvgCost = newBalanceQty > 0
          ? parseFloat((newBalanceTotalCost / newBalanceQty).toFixed(4))
          : 0;

        anularData.push({ productId: item.productId, quantity, newStock, unitCost, totalCost, newBalanceQty, newBalanceTotalCost, newAvgCost });
      }

      // Escrituras en un lote atomico de D1: stock, kardex y estado de la nota
      const batch = new D1Batch(D1, tenantId);
      for (const d of anularData) {
        batch.update('pos_products', d.productId, { stock: { increment: d.quantity } });
        batch.insert('pos_inventory_movements', {
          productId: d.productId,
          movementType: 'ajuste_entrada',
          concept: `Anulacion nota de entrega #${existing.number}`,
          quantity: d.quantity,
          absQuantity: d.quantity,
          unitCost: parseFloat(d.unitCost.toFixed(4)),
          totalCost: d.totalCost,
          balanceQty: d.newBalanceQty,
          balanceTotalCost: d.newBalanceTotalCost,
          balanceAvgCost: d.newAvgCost,
          userId,
          userName,
          userRole,
          referenceId: existing.id,
        });
      }
      batch.update('pos_delivery_notes', body.id, { status: 'anulada' });
      await batch.commit();

      return NextResponse.json({ success: true, status: 'anulada' });
    }

    // Simple status update for 'recibida'
    const batch = new D1Batch(D1, tenantId);
    batch.update('pos_delivery_notes', body.id, { status: body.status });
    await batch.commit();

    return NextResponse.json(await loadNoteSql(D1, tenantId, body.id));
  } catch (error: any) {
    console.error('Error updating delivery note:', error);
    return NextResponse.json({ error: 'Error al actualizar nota de entrega: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const deliveryNote = await loadNoteSql(D1, tenantId, id);

    if (!deliveryNote) {
      return NextResponse.json({ error: 'Nota de entrega no encontrada' }, { status: 404 });
    }

    if (deliveryNote.status !== 'emitida') {
      return NextResponse.json({ error: 'Solo se pueden eliminar notas en estado "emitida"' }, { status: 400 });
    }

    // Los items se borran en cascada (ON DELETE CASCADE)
    const batch = new D1Batch(D1, tenantId);
    batch.delete('pos_delivery_notes', id);
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting delivery note:', error);
    return NextResponse.json({ error: 'Error al eliminar nota de entrega' }, { status: 500 });
  }
}
