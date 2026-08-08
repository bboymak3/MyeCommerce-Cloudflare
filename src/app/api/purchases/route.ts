import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const supplierId = searchParams.get('supplierId');

    const purchases = await db.purchase.findMany({
      where: {
        ...(startDate && endDate ? { date: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') } } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        items: true,
        supplier: { select: { id: true, name: true, rif: true } },
      },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(purchases);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener compras' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items de compra son requeridos' }, { status: 400 });
    }
    const settings = await db.settings.findFirst();
    const exchangeRate = parseFloat(body.exchangeRate) || settings?.bcvRate || 36.5;

    // Calculate total from items
    const itemsTotal = body.items.reduce((sum: number, item: any) => sum + (parseFloat(item.unitCost) * parseFloat(item.quantity)), 0);

    // TRANSACTIONAL: create purchase + update stock
    const purchase = await db.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          date: body.date ? new Date(body.date) : new Date(),
          number: body.number || '',
          supplierId: body.supplierId || null,
          totalUsd: parseFloat(itemsTotal.toFixed(2)),
          totalBs: parseFloat((itemsTotal * exchangeRate).toFixed(2)),
          exchangeRate,
          notes: body.notes || '',
          items: {
            create: body.items.map((item: any) => ({
              productId: item.productId,
              productName: item.productName || '',
              quantity: parseFloat(item.quantity),
              unitCost: parseFloat(item.unitCost),
              total: parseFloat((parseFloat(item.unitCost) * parseFloat(item.quantity)).toFixed(2)),
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      // Auto-update product stock and cost
      for (const item of body.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: parseFloat(item.quantity) },
              ...(item.unitCost ? { cost: parseFloat(item.unitCost) } : {}),
            },
          });
        }
      }

      return newPurchase;
    });

    return NextResponse.json(purchase);
  } catch (error: any) {
    console.error('Error creating purchase:', error);
    return NextResponse.json({ error: 'Error al registrar compra' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // TRANSACTIONAL: restore stock + delete purchase
    await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
      if (purchase) {
        for (const item of purchase.items) {
          if (item.productId) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (product && product.stock >= item.quantity) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } },
              });
            }
          }
        }
        await tx.purchase.delete({ where: { id } });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar compra' }, { status: 500 });
  }
}
