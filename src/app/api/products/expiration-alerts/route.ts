import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const now = new Date();
    const warning15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days
    const warning30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const products = await db.product.findMany({
      where: {
        active: true,
        expirationDate: { not: null },
      },
      include: { category: true },
      orderBy: { expirationDate: 'asc' },
    });

    const expired: any[] = [];
    const warningSoon: any[] = []; // <= 15 days
    const warning30Days: any[] = [];  // <= 30 days

    for (const p of products) {
      if (!p.expirationDate) continue;
      const expDate = new Date(p.expirationDate);
      const entry = {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        expirationDate: p.expirationDate,
        stock: p.stock,
        price: p.price,
        cost: p.cost,
        icon: p.icon,
        categoryName: p.category?.name || '',
        daysLeft: Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      };

      if (expDate <= now) {
        expired.push({ ...entry, daysLeft: Math.max(0, entry.daysLeft) });
      } else if (expDate <= warning15) {
        warningSoon.push(entry);
      } else if (expDate <= warning30) {
        warning30Days.push(entry);
      }
    }

    return NextResponse.json({
      totalAlerts: expired.length + warningSoon.length + warning30Days.length,
      expiredCount: expired.length,
      warningSoonCount: warningSoon.length,
      warning30Count: warning30Days.length,
      expired,
      warningSoon,
      warning30: warning30Days,
    });
  } catch (error: any) {
    console.error('Expiration alerts error:', error);
    return NextResponse.json({ error: 'Error al consultar alertas de vencimiento' }, { status: 500 });
  }
}
