import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();

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

    const deliveryNote = await db.$transaction(async (tx) => {
      let totalUsd = 0;

      const note = await tx.deliveryNote.create({
        data: {
          number: nextNumber,
          userId,
          userName,
          recipientName: body.recipientName || '',
          recipientDoc: body.recipientDoc || '',
          recipientAddr: body.recipientAddr || '',
          reason: body.reason || '',
          notes: body.notes || '',
          totalUsd: 0, // will update below
          totalBs: 0,
          exchangeRate,
          status: 'emitida',
          items: {
            create: [], // placeholder
          },
        },
      });

      // Process each item: decrement stock + create inventory movement
      for (const item of body.items) {
        const productId = item.productId;
        const quantity = sf(item.quantity);

        if (quantity <= 0 || !productId) continue;

        // Get current product state
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) continue;

        // Get last inventory movement for this product to calculate average cost
        const lastMovement = await tx.inventoryMovement.findFirst({
          where: { productId },
          orderBy: { date: 'desc' },
        });

        const prevBalanceQty = lastMovement ? lastMovement.balanceQty : 0;
        const prevBalanceTotalCost = lastMovement ? lastMovement.balanceTotalCost : 0;
        const avgCost = prevBalanceQty > 0 ? prevBalanceTotalCost / prevBalanceQty : sf(product.cost);

        const unitCost = avgCost;
        const totalCost = parseFloat((quantity * unitCost).toFixed(4));

        // Update product stock (decrement)
        const newStock = parseFloat((product.stock - quantity).toFixed(4));
        await tx.product.update({
          where: { id: productId },
          data: { stock: newStock },
        });

        // Create inventory movement (nota_entrega - exit)
        const newBalanceQty = parseFloat((prevBalanceQty - quantity).toFixed(4));
        const newBalanceTotalCost = parseFloat((prevBalanceTotalCost - totalCost).toFixed(4));
        const newAvgCost = newBalanceQty > 0
          ? parseFloat((newBalanceTotalCost / newBalanceQty).toFixed(4))
          : 0;

        await tx.inventoryMovement.create({
          data: {
            productId,
            movementType: 'nota_entrega',
            concept: `Nota de entrega #${nextNumber}`,
            quantity: -quantity,
            absQuantity: quantity,
            unitCost: parseFloat(unitCost.toFixed(4)),
            totalCost,
            balanceQty: newBalanceQty,
            balanceTotalCost: newBalanceTotalCost,
            balanceAvgCost: newAvgCost,
            userId,
            userName,
            userRole,
            referenceId: note.id,
          },
        });

        // Create delivery note item
        await tx.deliveryNoteItem.create({
          data: {
            deliveryNoteId: note.id,
            productId,
            productName: item.productName || '',
            quantity,
            unitCost: parseFloat(unitCost.toFixed(4)),
            totalCost,
          },
        });

        totalUsd += totalCost;
      }

      // Update totals on the delivery note
      const totalBs = parseFloat((totalUsd * exchangeRate).toFixed(2));
      await tx.deliveryNote.update({
        where: { id: note.id },
        data: { totalUsd: parseFloat(totalUsd.toFixed(2)), totalBs },
      });

      // Return the completed note with items
      return tx.deliveryNote.findUnique({
        where: { id: note.id },
        include: { items: true },
      });
    });

    return NextResponse.json(deliveryNote, { status: 201 });
  } catch (error: any) {
    console.error('Error creating delivery note:', error);
    return NextResponse.json({ error: 'Error al crear nota de entrega: ' + (error.message || '') }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

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
      await db.$transaction(async (tx) => {
        for (const item of existing.items) {
          const quantity = item.quantity;
          if (quantity <= 0) continue;

          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;

          // Restore stock (increment)
          const newStock = parseFloat((product.stock + quantity).toFixed(4));
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: newStock },
          });

          // Get last inventory movement for average cost calculation
          const lastMovement = await tx.inventoryMovement.findFirst({
            where: { productId: item.productId },
            orderBy: { date: 'desc' },
          });

          const prevBalanceQty = lastMovement ? lastMovement.balanceQty : 0;
          const prevBalanceTotalCost = lastMovement ? lastMovement.balanceTotalCost : 0;
          const avgCost = item.unitCost > 0 ? item.unitCost : (prevBalanceQty > 0 ? prevBalanceTotalCost / prevBalanceQty : 0);

          const unitCost = avgCost;
          const totalCost = parseFloat((quantity * unitCost).toFixed(4));

          // Create compensating inventory movement (ajuste_entrada)
          const newBalanceQty = parseFloat((prevBalanceQty + quantity).toFixed(4));
          const newBalanceTotalCost = parseFloat((prevBalanceTotalCost + totalCost).toFixed(4));
          const newAvgCost = newBalanceQty > 0
            ? parseFloat((newBalanceTotalCost / newBalanceQty).toFixed(4))
            : 0;

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              movementType: 'ajuste_entrada',
              concept: `Anulacion nota de entrega #${existing.number}`,
              quantity,
              absQuantity: quantity,
              unitCost: parseFloat(unitCost.toFixed(4)),
              totalCost,
              balanceQty: newBalanceQty,
              balanceTotalCost: newBalanceTotalCost,
              balanceAvgCost: newAvgCost,
              userId,
              userName,
              userRole,
              referenceId: existing.id,
            },
          });
        }

        // Update delivery note status
        await tx.deliveryNote.update({
          where: { id: body.id },
          data: { status: 'anulada' },
        });
      });

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
