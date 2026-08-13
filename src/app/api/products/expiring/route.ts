import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');

    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);

    const products = await db.product.findMany({
      where: {
        active: true,
        expirationDate: { not: null, lte: threshold },
      },
      include: { category: true },
      orderBy: { expirationDate: 'asc' },
    });

    const now = new Date();
    const expired = products.filter(p => p.expirationDate && p.expirationDate <= now);
    const expiring = products.filter(p => p.expirationDate && p.expirationDate > now);

    return NextResponse.json({
      total: products.length,
      expiredCount: expired.length,
      expiringCount: expiring.length,
      expired: expired.map(p => ({
        id: p.id, name: p.name, barcode: p.barcode,
        expirationDate: p.expirationDate,
        stock: p.stock, category: p.category?.name || '',
        daysExpired: Math.floor((now.getTime() - (p.expirationDate?.getTime() || 0)) / 86400000),
      })),
      expiring: expiring.map(p => ({
        id: p.id, name: p.name, barcode: p.barcode,
        expirationDate: p.expirationDate,
        stock: p.stock, category: p.category?.name || '',
        daysRemaining: Math.ceil(((p.expirationDate?.getTime() || 0) - now.getTime()) / 86400000),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener alertas de vencimiento' }, { status: 500 });
  }
}
