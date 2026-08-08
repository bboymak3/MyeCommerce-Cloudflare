import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';

    const where: any = { clientId };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom + 'T00:00:00');
      if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59');
    }

    const sales = await db.sale.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(sales);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}