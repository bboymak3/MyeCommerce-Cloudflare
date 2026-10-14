export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow } from '@/lib/d1-batch';
import { d1Of, placeholders, selectRow, selectRows } from '@/lib/d1-read';

// Sin Prisma: lecturas con SQL directo (ver "Limite de CPU" en CLAUDE.md)

const CLIENT_COLS = 'id, fullName, docType, docNumber, creditBalance';

/** Ventas a credito (formato Prisma) con sus abonos (por fecha), su cliente y, si se pide, sus items. */
async function creditSalesSql(D1: D1Database, tenantId: string, where: string, params: unknown[], withItems: boolean) {
  const sales = await selectRows<any>(D1, 'pos_sales', `SELECT * FROM pos_sales WHERE tenant_id = ?1 ${where} ORDER BY date DESC`, tenantId, ...params);
  if (sales.length === 0) return [];
  const ids = sales.map((x) => x.id);
  const clientIds = [...new Set(sales.map((x) => x.clientId).filter(Boolean))] as string[];
  const [payRes, cliRes, itemRes] = await D1.batch([
    D1.prepare(`SELECT * FROM pos_credit_payments WHERE tenant_id = ?1 AND saleId IN (${placeholders(ids.length, 2)}) ORDER BY date ASC`).bind(tenantId, ...ids),
    D1.prepare(`SELECT ${CLIENT_COLS} FROM pos_clients WHERE tenant_id = ?1 AND id IN (${placeholders(Math.max(1, clientIds.length), 2)})`).bind(tenantId, ...(clientIds.length ? clientIds : [''])),
    D1.prepare(`SELECT si.*, p.name AS _pname, p.id AS _pid FROM pos_sale_items si LEFT JOIN pos_products p ON p.id = si.productId
      WHERE si.tenant_id = ?1 AND si.saleId IN (${placeholders(ids.length, 2)}) ORDER BY si.rowid`).bind(tenantId, ...(withItems ? ids : ids.map(() => ''))),
  ]);
  const group = (rows: any[], key: string, map: (r: any) => any) => {
    const m = new Map<string, any[]>();
    for (const r of rows) { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key])!.push(map(r)); }
    return m;
  };
  const payments = group((payRes.results || []) as any[], 'saleId', (r) => fromDbRow('pos_credit_payments', r));
  const clients = new Map(((cliRes.results || []) as any[]).map((c) => [c.id, { id: c.id, fullName: c.fullName, docType: c.docType, docNumber: c.docNumber, creditBalance: c.creditBalance }]));
  const items = group((itemRes.results || []) as any[], 'saleId', ({ _pname, _pid, ...it }) => ({ ...fromDbRow('pos_sale_items', it), product: _pid ? { name: _pname } : null }));
  return sales.map((x) => ({
    ...x,
    creditPayments: payments.get(x.id) || [],
    client: (x.clientId && clients.get(x.clientId)) || null,
    ...(withItems ? { items: items.get(x.id) || [] } : {}),
  }));
}

// GET /api/credit - List credit accounts (clients with debt)
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const saleId = searchParams.get('saleId');
    const showPayments = searchParams.get('payments') === 'true';
    const all = searchParams.get('all') === 'true';

    // If requesting payments for a specific sale
    if (showPayments && saleId) {
      const payments = await selectRows(D1, 'pos_credit_payments',
        'SELECT * FROM pos_credit_payments WHERE tenant_id = ?1 AND saleId = ?2 ORDER BY date DESC', tenantId, saleId);
      return NextResponse.json(payments);
    }

    // If filtering by specific client
    if (clientId) {
      const creditSales = await creditSalesSql(D1, tenantId, 'AND clientId = ?2 AND isCredit = 1', [clientId], false);
      return NextResponse.json(creditSales);
    }

    // If filtering by specific sale
    if (saleId) {
      const [sale] = await creditSalesSql(D1, tenantId, 'AND id = ?2', [saleId], true);
      return NextResponse.json(sale || null);
    }

    // Default: all clients with credit debt
    // Get current BCV rate from settings for Bs conversion
    const settings: any = await D1.prepare('SELECT bcvRate FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId).first();
    const bcvRate = settings?.bcvRate || 36.5;

    // Find clients with REAL unpaid credit by checking actual sales data
    // (creditBalance field can be stale, so we compute from sales)
    const { results: creditRows } = await D1.prepare(
      'SELECT clientId, total, creditPaid FROM pos_sales WHERE tenant_id = ?1 AND isCredit = 1 AND clientId IS NOT NULL',
    ).bind(tenantId).all();
    const allCreditSales = (creditRows || []) as { clientId: string | null; total: number; creditPaid: number }[];

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
      const { results: balRows } = await D1.prepare('SELECT id, creditBalance FROM pos_clients WHERE tenant_id = ?1 AND creditBalance > 0').bind(tenantId).all();
      const clientsByBalance = (balRows || []) as { id: string; creditBalance: number }[];
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
    const ph = placeholders(clientIdsWithDebt.length, 2);
    const clientsWithDebt = await selectRows<any>(D1, 'pos_clients',
      `SELECT * FROM pos_clients WHERE tenant_id = ?1 AND id IN (${ph}) ORDER BY fullName ASC`, tenantId, ...clientIdsWithDebt);

    // Traer TODAS las ventas a credito de esos clientes en 1 sola query
    const allCreditSalesDetail = (await selectRows<any>(D1, 'pos_sales',
      `SELECT clientId, id, total, totalBs, creditPaid, creditDays, creditDueDate, date, exchangeRate FROM pos_sales
       WHERE tenant_id = ?1 AND clientId IN (${ph}) AND isCredit = 1 ORDER BY date DESC`, tenantId, ...clientIdsWithDebt)) as
      { clientId: string | null; id: string; total: number; totalBs: number; creditPaid: number; creditDays: number; creditDueDate: string | null; date: string; exchangeRate: number }[];

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
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    const amount = parseFloat(body.amount);

    if (!body.saleId || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Venta y monto valido son requeridos' }, { status: 400 });
    }

    // Get the sale
    const sale: any = await selectRow(D1, 'pos_sales', 'SELECT * FROM pos_sales WHERE tenant_id = ?1 AND id = ?2', tenantId, String(body.saleId));
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    if (!sale.isCredit) return NextResponse.json({ error: 'Esta venta no es a credito' }, { status: 400 });

    const remaining = Number(sale.total || 0) - Number(sale.creditPaid || 0);
    if (amount > remaining + 0.01) {
      return NextResponse.json({ error: `El monto excede el saldo pendiente ($${remaining.toFixed(2)})` }, { status: 400 });
    }

    // Clamp amount to remaining to prevent overpayment
    const finalAmount = Math.min(amount, remaining);

    const settings: any = await D1.prepare('SELECT bcvRate FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId).first();
    const exchangeRate = parseFloat(body.exchangeRate) || settings?.bcvRate || 36.5;

    // D1 BATCH TRANSACTION: reads first, then batch writes
    // Re-check remaining to prevent race condition — READ FIRST
    const freshSale = sale;
    if (!freshSale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    const txRemaining = Number(freshSale.total || 0) - Number(freshSale.creditPaid || 0);
    const txAmount = Math.min(finalAmount, txRemaining);
    if (txAmount <= 0) return NextResponse.json({ error: 'Esta venta ya esta completamente pagada' }, { status: 400 });

    // Read client credit balance — READ FIRST
    let clientCreditBalance: number | null = null;
    if (sale.clientId) {
      const client: any = await D1.prepare('SELECT creditBalance FROM pos_clients WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, sale.clientId).first();
      if (client) {
        clientCreditBalance = Number(client.creditBalance || 0);
      }
    }

    // Escrituras en un lote atomico de D1. Los saldos se calculan en la base de datos
    // para que dos abonos simultaneos no se pisen.
    const batch = new D1Batch(D1, tenantId);
    // Usar SIEMPRE el clientId de la venta, nunca el del body
    const paymentId = batch.insert('pos_credit_payments', {
      saleId: body.saleId,
      clientId: sale.clientId || null,
      date: new Date(),
      amount: txAmount,
      exchangeRate,
      amountBs: Number((txAmount * exchangeRate).toFixed(2)),
      method: body.method || 'efectivo',
      reference: body.reference || '',
      notes: body.notes || '',
      createdBy: req.headers.get('x-username') || body.createdBy || '',
    });
    batch.raw('UPDATE "pos_sales" SET "creditPaid" = ROUND("creditPaid" + ?, 2) WHERE "id" = ? AND "tenant_id" = ?', txAmount, body.saleId);
    if (sale.clientId && clientCreditBalance !== null) {
      batch.raw('UPDATE "pos_clients" SET "creditBalance" = MAX(0, ROUND("creditBalance" - ?, 2)), "updatedAt" = ? WHERE "id" = ? AND "tenant_id" = ?', txAmount, new Date(), sale.clientId);
    }
    await batch.commit();
    const payment = await selectRow(D1, 'pos_credit_payments', 'SELECT * FROM pos_credit_payments WHERE tenant_id = ?1 AND id = ?2', tenantId, paymentId);

    return NextResponse.json(payment);
  } catch (error: any) {
    console.error('Error registering credit payment:', error);
    return NextResponse.json({ error: 'Error al registrar abono' }, { status: 500 });
  }
}
