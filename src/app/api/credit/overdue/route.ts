export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { toDbDate } from '@/lib/d1-batch';

// GET /api/credit/overdue - Returns count + summary of overdue credits
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const now = new Date();
    // Ventas a credito vencidas (SQL directo: se pide al abrir la app; ver "Limite de CPU" en CLAUDE.md)
    const { results } = await (env as any).DB.prepare(
      `SELECT s.id, s.total, s.creditPaid, s.creditDueDate, c.fullName AS clientName
       FROM pos_sales s LEFT JOIN pos_clients c ON c.id = s.clientId
       WHERE s.tenant_id = ?1 AND s.isCredit = 1 AND s.creditDueDate IS NOT NULL AND s.creditDueDate < ?2
       ORDER BY s.creditDueDate ASC`
    ).bind(tenantId, toDbDate(now)).all();
    const allCreditSales = (results as any[]).map((r) => ({
      id: r.id, total: Number(r.total) || 0, creditPaid: Number(r.creditPaid) || 0,
      creditDueDate: new Date(r.creditDueDate),
      client: r.clientName != null ? { fullName: r.clientName } : null,
    }));

    // Solo las que aun tienen saldo. El total y la cantidad cuentan todas; la lista muestra 10.
    const overdueSales = allCreditSales.filter(s => (s.total || 0) - (s.creditPaid || 0) > 0.01);

    const count = overdueSales.length;
    const totalOverdueUsd = overdueSales.reduce(
      (sum, s) => sum + ((s.total || 0) - (s.creditPaid || 0)), 0
    );

    return NextResponse.json({
      count,
      totalOverdueUsd: Number(totalOverdueUsd.toFixed(2)),
      sales: overdueSales.slice(0, 10).map(s => ({
        id: s.id,
        clientName: s.client?.fullName || 'Cliente',
        remaining: Number(((s.total || 0) - (s.creditPaid || 0)).toFixed(2)),
        dueDate: s.creditDueDate,
        daysOverdue: Math.floor((now.getTime() - new Date(s.creditDueDate).getTime()) / (1000 * 60 * 60 * 24)),
      })),
    });
  } catch (error) {
    console.error('[CreditOverdue] Error:', error);
    return NextResponse.json({ count: 0, totalOverdueUsd: 0, sales: [] });
  }
}
