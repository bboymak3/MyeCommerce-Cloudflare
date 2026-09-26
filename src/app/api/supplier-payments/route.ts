export const runtime = 'edge';
import { createDbFromEnv, getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/supplier-payments — cuentas por pagar (proveedores con deuda) o el detalle de una compra
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const purchaseId = searchParams.get('purchaseId');

    if (purchaseId) {
      const payments = await db.supplierPayment.findMany({ where: { purchaseId }, orderBy: { date: 'asc' } });
      return NextResponse.json(payments);
    }

    if (supplierId) {
      const creditPurchases = await db.purchase.findMany({
        where: { supplierId, isCredit: true },
        include: { payments: { orderBy: { date: 'asc' } }, supplier: { select: { id: true, name: true, rif: true, payableBalance: true } } },
        orderBy: { date: 'desc' },
      });
      return NextResponse.json(creditPurchases);
    }

    // Por defecto: proveedores con deuda vigente (compras a credito no cubiertas)
    const settings = await db.settings.findFirst();
    const bcvRate = settings?.bcvRate || 36.5;
    const creditPurchases = await db.purchase.findMany({
      where: { isCredit: true, supplierId: { not: null } },
      include: { supplier: { select: { id: true, name: true, rif: true, phone: true } } },
      orderBy: { date: 'desc' },
    });

    const bySupplier = new Map<string, any>();
    for (const p of creditPurchases) {
      const remaining = Number(p.totalUsd || 0) - Number(p.paidAmount || 0);
      if (remaining <= 0.01) continue;
      const key = p.supplierId as string;
      if (!bySupplier.has(key)) {
        bySupplier.set(key, {
          supplierId: key,
          supplierName: p.supplier?.name || '',
          rif: p.supplier?.rif || '',
          phone: p.supplier?.phone || '',
          totalOwedUsd: 0,
          totalOwedBs: 0,
          purchaseCount: 0,
          oldestDueDate: p.dueDate,
          overdue: false,
        });
      }
      const acc = bySupplier.get(key);
      acc.totalOwedUsd = Number((acc.totalOwedUsd + remaining).toFixed(2));
      acc.totalOwedBs = Number((acc.totalOwedUsd * bcvRate).toFixed(2));
      acc.purchaseCount++;
      if (p.dueDate && (!acc.oldestDueDate || p.dueDate < acc.oldestDueDate)) acc.oldestDueDate = p.dueDate;
      if (p.dueDate && new Date(p.dueDate) < new Date()) acc.overdue = true;
    }

    return NextResponse.json(Array.from(bySupplier.values()));
  } catch (error) {
    console.error('Error fetching supplier payments:', error);
    return NextResponse.json({ error: 'Error al obtener cuentas por pagar' }, { status: 500 });
  }
}

// POST /api/supplier-payments — registrar un abono a una compra a credito
export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const body = await req.json() as any;
    const amount = parseFloat(body.amount);

    if (!body.purchaseId || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Compra y monto valido son requeridos' }, { status: 400 });
    }

    const purchase = await db.purchase.findUnique({ where: { id: body.purchaseId } });
    if (!purchase) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    if (!purchase.isCredit) return NextResponse.json({ error: 'Esta compra no es a credito' }, { status: 400 });

    const remaining = Number(purchase.totalUsd || 0) - Number(purchase.paidAmount || 0);
    if (amount > remaining + 0.01) {
      return NextResponse.json({ error: `El monto excede el saldo pendiente ($${remaining.toFixed(2)})` }, { status: 400 });
    }
    const finalAmount = Math.min(amount, remaining);

    const exchangeRate = parseFloat(body.exchangeRate) || 36.5;

    let supplierBalance: number | null = null;
    if (purchase.supplierId) {
      const supplier = await db.supplier.findUnique({ where: { id: purchase.supplierId } });
      if (supplier) supplierBalance = Number(supplier.payableBalance || 0);
    }

    const ops: any[] = [];

    ops.push(db.supplierPayment.create({
      data: {
        purchaseId: body.purchaseId,
        supplierId: purchase.supplierId || null,
        date: new Date(),
        amount: finalAmount,
        exchangeRate,
        amountBs: Number((finalAmount * exchangeRate).toFixed(2)),
        method: body.method || 'efectivo',
        reference: body.reference || '',
        notes: body.notes || '',
        createdBy: req.headers.get('x-username') || body.createdBy || '',
      },
    }));

    ops.push(db.purchase.update({
      where: { id: body.purchaseId },
      data: { paidAmount: Number((Number(purchase.paidAmount || 0) + finalAmount).toFixed(2)) },
    }));

    if (purchase.supplierId && supplierBalance !== null) {
      const newBalance = Math.max(0, supplierBalance - finalAmount);
      ops.push(db.supplier.update({
        where: { id: purchase.supplierId },
        data: { payableBalance: Number(newBalance.toFixed(2)) },
      }));
    }

    const results = await db.$transaction(ops);
    return NextResponse.json(results[0]);
  } catch (error: any) {
    console.error('Error registering supplier payment:', error);
    return NextResponse.json({ error: 'Error al registrar abono' }, { status: 500 });
  }
}
