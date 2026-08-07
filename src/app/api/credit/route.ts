import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/credit - List credit accounts (clients with debt)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const saleId = searchParams.get('saleId');
    const showPayments = searchParams.get('payments') === 'true';
    const all = searchParams.get('all') === 'true';

    // If requesting payments for a specific sale
    if (showPayments && saleId) {
      const payments = await db.creditPayment.findMany({
        where: { saleId },
        orderBy: { date: 'desc' },
      });
      return NextResponse.json(payments);
    }

    // If filtering by specific client
    if (clientId) {
      const creditSales = await db.sale.findMany({
        where: { clientId, isCredit: true },
        include: {
          creditPayments: { orderBy: { date: 'asc' } },
          client: { select: { id: true, fullName: true, docType: true, docNumber: true, creditBalance: true } },
        },
        orderBy: { date: 'desc' },
      });
      return NextResponse.json(creditSales);
    }

    // If filtering by specific sale
    if (saleId) {
      const sale = await db.sale.findUnique({
        where: { id: saleId },
        include: {
          creditPayments: { orderBy: { date: 'asc' } },
          client: { select: { id: true, fullName: true, docType: true, docNumber: true, creditBalance: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      });
      return NextResponse.json(sale);
    }

    // Default: all clients with credit debt
    // Get current BCV rate from settings for Bs conversion
    const settings = await db.settings.findFirst();
    const bcvRate = settings?.bcvRate || 36.5;

    // Find clients with REAL unpaid credit by checking actual sales data
    // (creditBalance field can be stale, so we compute from sales)
    const allCreditSales = await db.sale.findMany({
      where: { isCredit: true, clientId: { not: null } },
      select: { clientId: true, total: true, creditPaid: true },
    });

    // Build map of clientId -> actual debt from sales
    const clientDebtMap = new Map<string, number>();
    for (const s of allCreditSales) {
      if (!s.clientId) continue;
      const remaining = (s.total || 0) - (s.creditPaid || 0);
      if (remaining > 0.01) {
        clientDebtMap.set(s.clientId, (clientDebtMap.get(s.clientId) || 0) + remaining);
      }
    }

    // Also include clients with creditBalance > 0 (catches orphaned balances)
    if (!all) {
      const clientsByBalance = await db.client.findMany({
        where: { creditBalance: { gt: 0 } },
        select: { id: true, creditBalance: true },
      });
      for (const c of clientsByBalance) {
        if (!clientDebtMap.has(c.id)) {
          clientDebtMap.set(c.id, Number(c.creditBalance || 0));
        }
      }
    }

    // Get unique client IDs that have debt
    const clientIdsWithDebt = [...clientDebtMap.keys()];

    if (clientIdsWithDebt.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch those clients
    const clientsWithDebt = await db.client.findMany({
      where: { id: { in: clientIdsWithDebt } },
      include: {
        _count: { select: { sales: { where: { isCredit: true } } } },
      },
      orderBy: { fullName: 'asc' },
    });

    // Traer TODAS las ventas a credito de esos clientes en 1 sola query
    const allCreditSalesDetail = await db.sale.findMany({
      where: { clientId: { in: clientIdsWithDebt }, isCredit: true },
      select: { clientId: true, id: true, total: true, totalBs: true, creditPaid: true, creditDays: true, creditDueDate: true, date: true, exchangeRate: true },
      orderBy: { date: 'desc' },
    });

    // Agrupar por cliente en memoria
    const salesByClient = new Map<string, typeof allCreditSalesDetail>();
    for (const s of allCreditSalesDetail) {
      if (!s.clientId) continue;
      if (!salesByClient.has(s.clientId)) salesByClient.set(s.clientId, []);
      salesByClient.get(s.clientId)!.push(s);
    }

    const creditData = clientsWithDebt.map(client => {
      const creditSales = salesByClient.get(client.id) || [];
      const totalOwed = creditSales.reduce((sum, s) => sum + (s.total || 0) - (s.creditPaid || 0), 0);
      return {
        id: client.id,
        fullName: client.fullName || '',
        docType: client.docType || '',
        docNumber: client.docNumber || '',
        creditBalance: Number(client.creditBalance || 0),
        creditLimit: Number((client as any).creditLimit || 0),
        creditSalesCount: creditSales.length,
        totalOwedUsd: Number(totalOwed.toFixed(2)),
        totalOwedBs: Number((totalOwed * bcvRate).toFixed(2)),
        sales: creditSales.map(s => ({
          id: s.id,
          date: s.date,
          total: s.total || 0,
          paid: s.creditPaid || 0,
          creditDays: s.creditDays,
          creditDueDate: s.creditDueDate,
          remaining: Number(((s.total || 0) - (s.creditPaid || 0)).toFixed(2)),
        })),
      };
    });

    // Sort by total owed descending
    creditData.sort((a, b) => b.totalOwedUsd - a.totalOwedUsd);

    return NextResponse.json(creditData);
  } catch (error) {
    console.error('Error in credit route:', error);
    return NextResponse.json({ error: 'Error al obtener cuentas por cobrar' }, { status: 500 });
  }
}

// POST /api/credit - Register payment (abono)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const amount = parseFloat(body.amount);

    if (!body.saleId || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Venta y monto valido son requeridos' }, { status: 400 });
    }

    // Get the sale
    const sale = await db.sale.findUnique({ where: { id: body.saleId } });
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    if (!sale.isCredit) return NextResponse.json({ error: 'Esta venta no es a credito' }, { status: 400 });

    const remaining = Number(sale.total || 0) - Number(sale.creditPaid || 0);
    if (amount > remaining + 0.01) {
      return NextResponse.json({ error: `El monto excede el saldo pendiente ($${remaining.toFixed(2)})` }, { status: 400 });
    }

    // Clamp amount to remaining to prevent overpayment
    const finalAmount = Math.min(amount, remaining);

    const exchangeRate = parseFloat(body.exchangeRate) || 36.5;

    // TRANSACTIONAL: re-check remaining inside transaction to prevent race condition
    const payment = await db.$transaction(async (tx) => {
      const freshSale = await tx.sale.findUnique({ where: { id: body.saleId } });
      if (!freshSale) throw new Error('Venta no encontrada');
      const txRemaining = Number(freshSale.total || 0) - Number(freshSale.creditPaid || 0);
      const txAmount = Math.min(finalAmount, txRemaining);
      if (txAmount <= 0) throw new Error('Esta venta ya esta completamente pagada');

      const newPaid = Number(freshSale.creditPaid || 0) + txAmount;

      // Create payment record - usar SIEMPRE el clientId de la venta, no del body
      const newPayment = await tx.creditPayment.create({
        data: {
          saleId: body.saleId,
          clientId: sale.clientId || null, // Siempre usar el de la venta, nunca el del body
          date: new Date(),
          amount: txAmount,
          exchangeRate,
          amountBs: Number((txAmount * exchangeRate).toFixed(2)),
          method: body.method || 'efectivo',
          reference: body.reference || '',
          notes: body.notes || '',
          createdBy: body.createdBy || '',
        },
      });

      // Update sale creditPaid
      await tx.sale.update({
        where: { id: body.saleId },
        data: { creditPaid: Number((Number(freshSale.creditPaid || 0) + txAmount).toFixed(2)) },
      });

      // Update client credit balance
      if (sale.clientId) {
        const client = await tx.client.findUnique({ where: { id: sale.clientId } });
        if (client) {
          const currentBalance = Number(client.creditBalance || 0);
          const newBalance = Math.max(0, currentBalance - txAmount);
          await tx.client.update({
            where: { id: sale.clientId },
            data: { creditBalance: Number(newBalance.toFixed(2)) },
          });
        }
      }

      return newPayment;
    });

    return NextResponse.json(payment);
  } catch (error: any) {
    console.error('Error registering credit payment:', error);
    return NextResponse.json({ error: 'Error al registrar abono' }, { status: 500 });
  }
}
