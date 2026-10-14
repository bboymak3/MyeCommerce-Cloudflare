export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { d1Of } from '@/lib/d1-read';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    // SQL directo (ver "Limite de CPU" en CLAUDE.md)
    const { results } = await d1Of(env).prepare(
      `SELECT s.clientId, s.date, s.total, s.totalBs, c.id AS cid, c.fullName, c.phone, c.email, c.type
       FROM pos_sales s LEFT JOIN pos_clients c ON c.id = s.clientId
       WHERE s.tenant_id = ?1 AND s.clientId IS NOT NULL ORDER BY s.date DESC`,
    ).bind(tenantId).all();
    const sales = ((results || []) as any[]).map((r) => ({
      clientId: r.clientId as string | null,
      date: new Date(r.date),
      total: Number(r.total) || 0,
      totalBs: Number(r.totalBs) || 0,
      client: r.cid ? { fullName: r.fullName, phone: r.phone, email: r.email, type: r.type } : null,
    }));

    // Group by client
    const clientMap = new Map<string, {
      clientId: string;
      fullName: string;
      phone: string;
      email: string;
      type: string;
      totalSales: number;
      totalUsd: number;
      totalBs: number;
      firstPurchase: Date;
      lastPurchase: Date;
      avgTicket: number;
    }>();

    for (const sale of sales) {
      if (!sale.clientId) continue;
      const cid = sale.clientId;
      const client = sale.client;

      if (!clientMap.has(cid)) {
        clientMap.set(cid, {
          clientId: cid,
          fullName: client?.fullName || 'Desconocido',
          phone: client?.phone || '',
          email: client?.email || '',
          type: client?.type || 'natural',
          totalSales: 0,
          totalUsd: 0,
          totalBs: 0,
          firstPurchase: sale.date,
          lastPurchase: sale.date,
          avgTicket: 0,
        });
      }

      const entry = clientMap.get(cid)!;
      entry.totalSales += 1;
      entry.totalUsd += sale.total || 0;
      entry.totalBs += sale.totalBs || 0;
      if (sale.date < entry.firstPurchase) entry.firstPurchase = sale.date;
      if (sale.date > entry.lastPurchase) entry.lastPurchase = sale.date;
    }

    // Calculate avg ticket and frequency for each client
    const stats = Array.from(clientMap.values()).map(c => ({
      ...c,
      avgTicket: c.totalSales > 0 ? c.totalUsd / c.totalSales : 0,
      // Frequency: days between purchases on average
      daySpan: Math.max(1, Math.ceil((c.lastPurchase.getTime() - c.firstPurchase.getTime()) / (1000 * 60 * 60 * 24))),
      frequencyLabel: c.totalSales > 1
        ? `${Math.ceil(Math.ceil((c.lastPurchase.getTime() - c.firstPurchase.getTime()) / (1000 * 60 * 60 * 24)) / (c.totalSales - 1))} dias entre compras`
        : 'Primera compra',
    }));

    // Sort by total USD spent (top buyers)
    const topBuyers = [...stats].sort((a, b) => b.totalUsd - a.totalUsd).slice(0, 20);

    // Sort by frequency (most frequent shoppers, at least 2 purchases)
    const topFrequent = [...stats].filter(c => c.totalSales >= 2).sort((a, b) => {
      const freqA = a.daySpan / (a.totalSales - 1);
      const freqB = b.daySpan / (b.totalSales - 1);
      return freqA - freqB; // Lower days between = more frequent
    }).slice(0, 20);

    return NextResponse.json({ topBuyers, topFrequent, totalClients: stats.length });
  } catch (error: any) {
    console.error('Client stats error:', error);
    return NextResponse.json({ error: 'Error al obtener estadisticas de clientes' }, { status: 500 });
  }
}
