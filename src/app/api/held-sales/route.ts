import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'espera';
    const userId = searchParams.get('userId');

    const heldSales = await db.heldSale.findMany({
      where: {
        status,
        ...(userId ? { userId } : {}),
      },
      include: { items: true, client: { select: { id: true, fullName: true, docType: true, docNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(heldSales);
  } catch (error) {
    console.error('Error fetching held sales:', error);
    return NextResponse.json({ error: 'Error al obtener facturas en espera' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items son requeridos' }, { status: 400 });
    }

    // Validar que cada item tenga productId válido
    const validItems = body.items.filter((item: any) => {
      const pid = item.productId || item.id;
      return pid && typeof pid === 'string' && pid.trim() !== '';
    }).map((item: any) => ({
      productId: item.productId || item.id,
      productName: item.productName || item.name || 'Sin nombre',
      quantity: sf(item.quantity),
      unitPrice: sf(item.unitPrice || item.price),
      total: sf(item.total),
      taxType: item.taxType || 'general',
    }));

    if (validItems.length === 0) {
      logError('held-sales', 'Todos los items carecen de productId valido', { rawItems: body.items }, body.userId);
      return NextResponse.json({ error: 'Los productos del carrito no son validos. Vuelva a agregarlos.' }, { status: 400 });
    }

    // Get next sequential number
    const lastHeld = await db.heldSale.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const nextNumber = (lastHeld?.number || 0) + 1;

    const heldSale = await db.heldSale.create({
      data: {
        number: nextNumber,
        userId: body.userId || '',
        userName: body.userName || '',
        clientName: body.clientName || '',
        clientId: body.clientId || null,
        subtotal: sf(body.subtotal),
        taxAmount: sf(body.taxAmount),
        discount: sf(body.discount),
        total: sf(body.total),
        totalBs: sf(body.totalBs),
        exchangeRate: sf(body.exchangeRate),
        paymentMethod: body.paymentMethod || 'efectivo',
        notes: body.notes || '',
        status: 'espera',
        items: {
          create: validItems,
        },
      },
      include: { items: true },
    });

    return NextResponse.json(heldSale, { status: 201 });
  } catch (error: any) {
    logError('held-sales', 'Error al crear factura en espera', error, body?.userId);
    return NextResponse.json({ error: 'Error al crear factura en espera: ' + (error.message || '') }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    if (!body.status || !['recuperada', 'cancelada'].includes(body.status)) {
      return NextResponse.json({ error: 'Estado invalido. Use "recuperada" o "cancelada"' }, { status: 400 });
    }

    const existing = await db.heldSale.findUnique({
      where: { id: body.id },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Factura en espera no encontrada' }, { status: 404 });
    }

    if (existing.status !== 'espera') {
      return NextResponse.json({ error: 'Solo se pueden recuperar o cancelar facturas en estado "espera"' }, { status: 400 });
    }

    const updated = await db.heldSale.update({
      where: { id: body.id },
      data: { status: body.status },
      include: { items: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating held sale:', error);
    return NextResponse.json({ error: 'Error al actualizar factura en espera: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const heldSale = await db.heldSale.findUnique({ where: { id } });

    if (!heldSale) {
      return NextResponse.json({ error: 'Factura en espera no encontrada' }, { status: 404 });
    }

    if (heldSale.status !== 'espera') {
      return NextResponse.json({ error: 'Solo se pueden eliminar facturas en estado "espera"' }, { status: 400 });
    }

    await db.heldSale.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting held sale:', error);
    return NextResponse.json({ error: 'Error al eliminar factura en espera' }, { status: 500 });
  }
}
