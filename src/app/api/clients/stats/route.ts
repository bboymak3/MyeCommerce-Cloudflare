import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get all non-final clients with their sales
    const clients = await db.client.findMany({
      where: { isActive: true, isFinalClient: false },
      include: { _count: { select: { sales: true } } },
      orderBy: { sales: { _count: 'desc' } },
      take: limit,
    });

    // Get actual totals for each client
    const clientStats = await Promise.all(
      clients.map(async (client) => {
        const sales = await db.sale.findMany({
          where: { clientId: client.id, date: { gte: new Date(new Date().getFullYear(), 0, 1) } },
          select: { total: true, totalBs: true, date: true },
          orderBy: { date: 'desc' },
        });

        const totalUsd = sales.reduce((s, sale) => s + sale.total, 0);
        const totalBs = sales.reduce((s, sale) => s + sale.totalBs, 0);
        const avgTicket = sales.length > 0 ? totalUsd / sales.length : 0;
        const lastPurchase = sales[0]?.date || null;

        // Monthly frequency
        const months = new Set(sales.map(s => s.date.toISOString().slice(0, 7)));
        const avgFrequency = months.size > 0 ? sales.length / months.size : 0;

        return {
          id: client.id,
          fullName: client.fullName,
          docType: client.docType,
          docNumber: client.docNumber,
          phone: client.phone,
          email: client.email,
          purchaseCount: sales.length,
          totalUsd,
          totalBs,
          avgTicket,
          lastPurchase,
          monthlyFrequency: Math.round(avgFrequency * 10) / 10,
          creditBalance: client.creditBalance,
        };
      })
    );

    clientStats.sort((a, b) => b.totalUsd - a.totalUsd);

    const totalClients = await db.client.count({ where: { isActive: true, isFinalClient: false } });
    const activeClients = await db.sale.groupBy({
      by: ['clientId'],
      where: { clientId: { not: null }, date: { gte: new Date(new Date().getFullYear(), 0, 1) } },
    });

    return NextResponse.json({
      topBuyers: clientStats,
      summary: {
        totalClients,
        activeThisYear: activeClients.length,
        averagePurchasesPerClient: totalClients > 0 ? Math.round((clientStats.reduce((s, c) => s + c.purchaseCount, 0) / totalClients) * 10) / 10 : 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener estadisticas' }, { status: 500 });
  }
}
