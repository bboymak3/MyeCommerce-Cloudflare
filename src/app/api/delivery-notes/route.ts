export const runtime = 'edge';
import { createDbFromEnv, getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59'),
      };
    } else if (startDate) {
      where.createdAt = { gte: new Date(startDate) };
    } else if (endDate) {
      where.createdAt = { lte: new Date(endDate + 'T23:59:59') };
    }

    const deliveryNotes = await db.deliveryNote.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(deliveryNotes);
  } catch (error) {
    console.error('Error fetching delivery notes:', error);
    return NextResponse.json({ error: 'Error al obtener notas de entrega' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const body = await req.json() as any;

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items son requeridos' }, { status: 400 });
    }

    const exchangeRate = sf(body.exchangeRate);
    const userId = body.userId || '';
    const userName = body.userName || '';
    const userRole = req.headers.get('x-user-role') || '';

    // Get next sequential number
    const lastNote = await db.deliveryNote.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const nextNumber = (lastNote?.number || 0) + 1;

    // D1 BATCH TRANSACTION: reads first, then batch writes
    // Pre-read all products and last movements for each item
    const itemData: { productId: string; quantity: number; newStock: number; unitCost: number; totalCost: number; newBalanceQty: number; newBalanceTotalCost: number; newAvgCost: number; productName: string }[] = [];
    let totalUsd = 0;
    for (const item of body.items) {
      const productId = item.productId;
      const quantity = sf(item.quantity);
      if (quantity <= 0 || !productId) continue;

      const product = await db.product.findUnique({ where: { id: productId } });
      if (!product) continue;

      const lastMovement = await db.inventoryMovement.findFirst({
        where: { productId },
        orderBy: { date: 'desc' },
      });

      const prevBalanceQty = lastMovement ? lastMovement.balanceQty : 0;
      const prevBalanceTotalCost = lastMovement ? lastMovement.balanceTotalCost : 0;
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

    // Build batch write operations
    const ops: any[] = [];

    // Create delivery note with nested items and correct totals (op index 0)
    ops.push(db.deliveryNote.create({
      data: {
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
        items: {
          create: itemData.map(d => ({
            productId: d.productId,
            productName: d.productName,
            quantity: d.quantity,
            unitCost: parseFloat(d.unitCost.toFixed(4)),
            totalCost: d.totalCost,
          })),
        },
      },
      include: { items: true },
    }));

    // Update product stock and create inventory movements for each item
    for (const d of itemData) {
      ops.push(db.product.update({
        where: { id: d.productId },
        data: { stock: d.newStock },
      }));

      ops.push(db.inventoryMovement.create({
        data: {
          productId: d.productId,
          movementType: 'nota_entrega',
          concept: `Nota de entrega #${nextNumber}`,
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
          referenceId: '', // Note ID not available in batch mode
        },
      }));
    }

    // Execute batch transaction
    const results = await db.$transaction(ops);
    const deliveryNote = results[0];

    return NextResponse.json(deliveryNote, { status: 201 });
  } catch (error: any) {
    console.error('Error creating delivery note:', error);
    return NextResponse.json({ error: 'Error al crear nota de entrega: ' + (error.message || '') }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const body = await req.json() as any;

    if (!body.id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    if (!['recibida', 'anulada'].includes(body.status)) {
      return NextResponse.json({ error: 'Estado invalido. Use "recibida" o "anulada"' }, { status: 400 });
    }

    const existing = await db.deliveryNote.findUnique({
      where: { id: body.id },
      include: { items: true },
    });

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
      for (const item of existing.items) {
        const quantity = item.quantity;
        if (quantity <= 0) continue;

        const product = await db.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        const newStock = parseFloat((product.stock + quantity).toFixed(4));

        const lastMovement = await db.inventoryMovement.findFirst({
          where: { productId: item.productId },
          orderBy: { date: 'desc' },
        });

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

      // Build batch write operations
      const ops: any[] = [];
      for (const d of anularData) {
        ops.push(db.product.update({
          where: { id: d.productId },
          data: { stock: d.newStock },
        }));

        ops.push(db.inventoryMovement.create({
          data: {
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
          },
        }));
      }

      // Update delivery note status
      ops.push(db.deliveryNote.update({
        where: { id: body.id },
        data: { status: 'anulada' },
      }));

      await db.$transaction(ops);

      return NextResponse.json({ success: true, status: 'anulada' });
    }

    // Simple status update for 'recibida'
    const updated = await db.deliveryNote.update({
      where: { id: body.id },
      data: { status: body.status },
      include: { items: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating delivery note:', error);
    return NextResponse.json({ error: 'Error al actualizar nota de entrega: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const deliveryNote = await db.deliveryNote.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!deliveryNote) {
      return NextResponse.json({ error: 'Nota de entrega no encontrada' }, { status: 404 });
    }

    if (deliveryNote.status !== 'emitida') {
      return NextResponse.json({ error: 'Solo se pueden eliminar notas en estado "emitida"' }, { status: 400 });
    }

    await db.deliveryNote.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting delivery note:', error);
    return NextResponse.json({ error: 'Error al eliminar nota de entrega' }, { status: 500 });
  }
}
