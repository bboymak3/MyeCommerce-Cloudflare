import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 1000);

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [quotes, total] = await Promise.all([
      db.quote.findMany({
        where,
        include: { items: true, client: { select: { id: true, fullName: true, docType: true, docNumber: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.quote.count({ where }),
    ]);

    return NextResponse.json({
      quotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json({ error: 'Error al obtener presupuestos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items son requeridos' }, { status: 400 });
    }

    // Get next sequential number
    const lastQuote = await db.quote.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const nextNumber = (lastQuote?.number || 0) + 1;

    const quote = await db.quote.create({
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
        notes: body.notes || '',
        validUntil: body.validUntil || '',
        status: 'pendiente',
        items: {
          create: body.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName || '',
            quantity: sf(item.quantity),
            unitPrice: sf(item.unitPrice),
            total: sf(item.total),
            taxType: item.taxType || 'general',
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error: any) {
    console.error('Error creating quote:', error);
    return NextResponse.json({ error: 'Error al crear presupuesto: ' + (error.message || '') }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const existing = await db.quote.findUnique({
      where: { id: body.id },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    // Handle convert_to_sale action
    if (body.action === 'convert_to_sale') {
      if (existing.status !== 'pendiente' && existing.status !== 'aprobada') {
        return NextResponse.json({ error: 'Solo se pueden convertir presupuestos en estado "pendiente" o "aprobada"' }, { status: 400 });
      }

      await db.quote.update({
        where: { id: body.id },
        data: { status: 'convertida' },
      });

      // Return quote data so frontend can create a sale
      return NextResponse.json({
        convertToSale: true,
        quote: existing,
      });
    }

    // Handle status update
    if (body.status) {
      const validStatuses = ['pendiente', 'aprobada', 'convertida', 'vencida'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Estado invalido. Use: ${validStatuses.join(', ')}` }, { status: 400 });
      }

      const updated = await db.quote.update({
        where: { id: body.id },
        data: { status: body.status },
        include: { items: true },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Se requiere "status" o "action" en el body' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating quote:', error);
    return NextResponse.json({ error: 'Error al actualizar presupuesto: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const quote = await db.quote.findUnique({ where: { id } });

    if (!quote) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    if (quote.status !== 'pendiente') {
      return NextResponse.json({ error: 'Solo se pueden eliminar presupuestos en estado "pendiente"' }, { status: 400 });
    }

    await db.quote.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote:', error);
    return NextResponse.json({ error: 'Error al eliminar presupuesto' }, { status: 500 });
  }
}
