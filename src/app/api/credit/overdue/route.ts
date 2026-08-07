import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/credit/overdue - Returns count + summary of overdue credits
export async function GET() {
  try {
    const now = new Date();
    // Get all credit sales with due date before now
    const allCreditSales = await db.sale.findMany({
      where: {
        isCredit: true,
        creditDueDate: { lt: now },
      },
      select: {
        id: true,
        total: true,
        creditPaid: true,
        creditDueDate: true,
        client: { select: { fullName: true } },
      },
      orderBy: { creditDueDate: 'asc' },
    });

    // Filter to only those still with remaining balance
    const overdueSales = allCreditSales
      .filter(s => (s.creditPaid || 0) < (s.total || 0))
      .slice(0, 10);

    const count = overdueSales.length;
    const totalOverdueUsd = overdueSales.reduce(
      (sum, s) => sum + ((s.total || 0) - (s.creditPaid || 0)), 0
    );

    return NextResponse.json({
      count,
      totalOverdueUsd: Number(totalOverdueUsd.toFixed(2)),
      sales: overdueSales.map(s => ({
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
