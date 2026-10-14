export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow } from '@/lib/d1-batch';
import { d1Of, placeholders, selectRow, selectRows } from '@/lib/d1-read';

// Sin Prisma: lecturas con SQL directo (ver "Limite de CPU" en CLAUDE.md)

// GET /api/supplier-payments — cuentas por pagar (proveedores con deuda) o el detalle de una compra
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const purchaseId = searchParams.get('purchaseId');

    if (purchaseId) {
      const payments = await selectRows(D1, 'pos_supplier_payments',
        'SELECT * FROM pos_supplier_payments WHERE tenant_id = ?1 AND purchaseId = ?2 ORDER BY date ASC', tenantId, purchaseId);
      return NextResponse.json(payments);
    }

    if (supplierId) {
      const purchases = await selectRows<any>(D1, 'pos_purchases',
        'SELECT * FROM pos_purchases WHERE tenant_id = ?1 AND supplierId = ?2 AND isCredit = 1 ORDER BY date DESC', tenantId, supplierId);
      const ids = purchases.map((p) => p.id);
      const [payRes, supRes] = await D1.batch([
        D1.prepare(`SELECT * FROM pos_supplier_payments WHERE tenant_id = ?1 AND purchaseId IN (${placeholders(Math.max(1, ids.length), 2)}) ORDER BY date ASC`)
          .bind(tenantId, ...(ids.length ? ids : [''])),
        D1.prepare('SELECT id, name, rif, payableBalance FROM pos_suppliers WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, supplierId),
      ]);
      const payments = new Map<string, any[]>();
      for (const r of (payRes.results || []) as any[]) {
        if (!payments.has(r.purchaseId)) payments.set(r.purchaseId, []);
        payments.get(r.purchaseId)!.push(fromDbRow('pos_supplier_payments', r));
      }
      const sup: any = (supRes.results || [])[0];
      const supplier = sup ? { id: sup.id, name: sup.name, rif: sup.rif, payableBalance: sup.payableBalance } : null;
      const creditPurchases = purchases.map((p) => ({ ...p, payments: payments.get(p.id) || [], supplier }));
      return NextResponse.json(creditPurchases);
    }

    // Por defecto: proveedores con deuda vigente (compras a credito no cubiertas)
    const settings: any = await D1.prepare('SELECT bcvRate FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId).first();
    const bcvRate = settings?.bcvRate || 36.5;
    const { results: purchaseRows } = await D1.prepare(
      `SELECT p.*, s.id AS _sid, s.name AS _sname, s.rif AS _srif, s.phone AS _sphone
       FROM pos_purchases p LEFT JOIN pos_suppliers s ON s.id = p.supplierId
       WHERE p.tenant_id = ?1 AND p.isCredit = 1 AND p.supplierId IS NOT NULL ORDER BY p.date DESC`,
    ).bind(tenantId).all();
    const creditPurchases = ((purchaseRows || []) as any[]).map(({ _sid, _sname, _srif, _sphone, ...r }) => ({
      ...fromDbRow<any>('pos_purchases', r),
      supplier: _sid ? { id: _sid, name: _sname, rif: _srif, phone: _sphone } : null,
    }));

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
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    const amount = parseFloat(body.amount);

    if (!body.purchaseId || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Compra y monto valido son requeridos' }, { status: 400 });
    }

    const purchase: any = await selectRow(D1, 'pos_purchases', 'SELECT * FROM pos_purchases WHERE tenant_id = ?1 AND id = ?2', tenantId, String(body.purchaseId));
    if (!purchase) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    if (!purchase.isCredit) return NextResponse.json({ error: 'Esta compra no es a credito' }, { status: 400 });

    const remaining = Number(purchase.totalUsd || 0) - Number(purchase.paidAmount || 0);
    if (amount > remaining + 0.01) {
      return NextResponse.json({ error: `El monto excede el saldo pendiente ($${remaining.toFixed(2)})` }, { status: 400 });
    }
    const finalAmount = Math.min(amount, remaining);

    const settings: any = await D1.prepare('SELECT bcvRate FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId).first();
    const exchangeRate = parseFloat(body.exchangeRate) || settings?.bcvRate || 36.5;

    let supplierBalance: number | null = null;
    if (purchase.supplierId) {
      const supplier: any = await D1.prepare('SELECT payableBalance FROM pos_suppliers WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, purchase.supplierId).first();
      if (supplier) supplierBalance = Number(supplier.payableBalance || 0);
    }

    // Escrituras en un lote atomico de D1 (saldos calculados en la base de datos)
    const batch = new D1Batch(D1, tenantId);
    const paymentId = batch.insert('pos_supplier_payments', {
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
    });
    batch.raw('UPDATE "pos_purchases" SET "paidAmount" = ROUND("paidAmount" + ?, 2), "updatedAt" = ? WHERE "id" = ? AND "tenant_id" = ?', finalAmount, new Date(), body.purchaseId);
    if (purchase.supplierId && supplierBalance !== null) {
      batch.raw('UPDATE "pos_suppliers" SET "payableBalance" = MAX(0, ROUND("payableBalance" - ?, 2)), "updatedAt" = ? WHERE "id" = ? AND "tenant_id" = ?', finalAmount, new Date(), purchase.supplierId);
    }
    await batch.commit();
    return NextResponse.json(await selectRow(D1, 'pos_supplier_payments', 'SELECT * FROM pos_supplier_payments WHERE tenant_id = ?1 AND id = ?2', tenantId, paymentId));
  } catch (error: any) {
    console.error('Error registering supplier payment:', error);
    return NextResponse.json({ error: 'Error al registrar abono' }, { status: 500 });
  }
}
