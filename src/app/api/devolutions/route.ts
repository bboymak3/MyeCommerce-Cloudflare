import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 1000);

    const devolutions = await db.devolution.findMany({
      where: {
        ...(startDate && endDate
          ? {
              date: {
                gte: new Date(startDate),
                lte: new Date(endDate + 'T23:59:59'),
              },
            }
          : {}),
      },
      include: {
        sale: { include: { items: true } },
        items: { include: { product: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
    return NextResponse.json(devolutions);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener devoluciones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.saleId) {
      return NextResponse.json({ error: 'Venta requerida' }, { status: 400 });
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items de devolucion son requeridos' }, { status: 400 });
    }

    // Validar que la venta existe
    const sale = await db.sale.findUnique({
      where: { id: body.saleId },
      include: { items: true, devolutions: true },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    // Verificar cantidades devueltas no excedan lo vendido
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty < 1) {
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

    const settings = await db.settings.findFirst();
    const rate = settings?.bcvRate || 36.50;

    const totalUsd = body.items.reduce((sum: number, item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (qty * unitPrice);
    }, 0);

    // TRANSACTIONAL: create devolution + restore stock
    const devolution = await db.$transaction(async (tx) => {
      const newDevolution = await tx.devolution.create({
        data: {
          saleId: body.saleId,
          reason: body.reason || 'Devolucion',
          totalUsd,
          totalBs: totalUsd * rate,
          exchangeRate: rate,
          status: body.status || 'completada',
          items: {
      // Calcular total server-side por cada item (no confiar en el cliente)
            create: body.items.map((item: any) => {
              const qty = parseFloat(item.quantity) || 0;
              const unitPrice = parseFloat(item.unitPrice) || 0;
              return {
                productId: item.productId,
                productName: item.productName,
                quantity: qty,
                unitPrice,
                total: qty * unitPrice,
              };
            }),
          },
        },
        include: { items: true, sale: true },
      });

      // Restaurar stock
      for (const item of body.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: parseFloat(item.quantity) } },
        });
      }

      return newDevolution;
    });

    return NextResponse.json(devolution);
  } catch (error) {
    console.error('Error creating devolution:', error);
    return NextResponse.json({ error: 'Error al registrar devolucion' }, { status: 500 });
  }
}
