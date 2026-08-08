import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Obtiene la fecha/hora actual en Venezuela (UTC-4)
function getVenezuelaNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 4 * 3600000); // UTC-4
}

// ─── Labels de metodos de pago ─────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo (Bs)',
  'efectivo-usd': 'Efectivo ($)',
  transferencia: 'Transferencia',
  'pago-movil': 'Pago Movil',
  'punto-de-venta': 'Punto de Venta',
  cashea: 'Cashea',
  cheque: 'Cheque',
  zelle: 'Zelle',
  usdt: 'USDT',
};

/**
 * Helper: clasifica una venta en el breakdown desglosado por metodo de pago.
 * Cashea y Credito se EXCLUYEN del breakdown principal.
 */
function classifySale(
  s: { paymentMethod: string; total: number; totalBs: number; isCredit: boolean; mixedPaymentJson?: string | null; referenceNumber?: string },
  breakdown: Record<string, { usd: number; bs: number; count: number }>,
  cashea: { usd: number; bs: number; count: number },
) {
  if (s.isCredit) return;
  const m = s.paymentMethod.toLowerCase();

  const ensure = (key: string) => {
    if (!breakdown[key]) breakdown[key] = { usd: 0, bs: 0, count: 0 };
  };

  const add = (method: string, usd: number, bs: number) => {
    const k = method.toLowerCase();
    if (k === 'cashea') { cashea.usd += usd; cashea.bs += bs; cashea.count++; return; }
    ensure(k);
    breakdown[k].usd += usd;
    breakdown[k].bs += bs;
    breakdown[k].count++;
  };

  if (m === 'cashea') { cashea.usd += s.total; cashea.bs += s.totalBs; cashea.count++; return; }

  add(m, s.total, s.totalBs);

  if (m === 'mixto' && s.mixedPaymentJson) {
    try {
      const entries = JSON.parse(s.mixedPaymentJson) as Array<{ method: string; amountBs: number; amountUsd: number }>;
      entries.forEach((e) => {
        add(e.method, e.amountUsd || 0, e.amountBs);
      });
    } catch {}
  }
}

/**
 * Helper: extrae referencias de zelle/usdt/transferencia/pago-movil de las ventas.
 */
function extractReferences(sales: any[]): Array<{ saleId: string; method: string; label: string; reference: string; totalBs: number; totalUsd: number; customerName: string; saleTime: string }> {
  const refs: Array<any> = [];
  sales.forEach((s) => {
    const saleDate = new Date(s.date).toLocaleString("es-VE", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
    const customerName = s.customerName || 'Cliente Final';
    const refMethods = ['zelle', 'usdt', 'transferencia', 'pago-movil', 'punto-de-venta'];

    if (refMethods.includes(s.paymentMethod.toLowerCase())) {
      refs.push({
        saleId: s.id, method: s.paymentMethod.toLowerCase(),
        label: METHOD_LABELS[s.paymentMethod.toLowerCase()] || s.paymentMethod,
        reference: s.referenceNumber || 'Sin referencia',
        totalBs: s.totalBs, totalUsd: s.total,
        customerName, saleTime: saleDate,
      });
    } else if (s.paymentMethod === 'mixto' && s.mixedPaymentJson) {
      try {
        const entries = JSON.parse(s.mixedPaymentJson) as Array<{ method: string; amountBs: number; amountUsd: number; reference?: string }>;
        entries.forEach((entry) => {
          if (refMethods.includes(entry.method.toLowerCase()) && entry.amountBs > 0) {
            refs.push({
              saleId: s.id, method: entry.method.toLowerCase(),
              label: METHOD_LABELS[entry.method.toLowerCase()] || entry.method,
              reference: entry.reference || 'Sin referencia',
              totalBs: entry.amountBs,
              totalUsd: entry.amountUsd || parseFloat((entry.amountBs / (s.exchangeRate || 36.5)).toFixed(2)),
              customerName, saleTime: saleDate,
            });
          }
        });
      } catch {}
    }
  });
  return refs;
}

/**
 * Helper: construye el breakdownJson a partir del objeto breakdown.
 */
function buildBreakdownJson(breakdown: Record<string, { usd: number; bs: number; count: number }>): string {
  return JSON.stringify(breakdown);
}

/**
 * Helper: reconstruye breakdownJson desde columnas antiguas (compatibilidad).
 */
function rebuildLegacyBreakdown(closing: any): Record<string, { usd: number; bs: number; count: number }> {
  if (closing.breakdownJson && closing.breakdownJson !== '{}') {
    try { return JSON.parse(closing.breakdownJson); } catch {}
  }
  // Reconstruir desde columnas antiguas
  const b: Record<string, { usd: number; bs: number; count: number }> = {};
  if (closing.cashBs > 0 || closing.cashUsd > 0) b.efectivo = { usd: closing.cashUsd, bs: closing.cashBs, count: 0 };
  if ((closing as any).efectivoUsdBs > 0 || (closing as any).efectivoUsdUsd > 0) b['efectivo-usd'] = { usd: (closing as any).efectivoUsdUsd, bs: (closing as any).efectivoUsdBs, count: 0 };
  if (closing.cardBs > 0 || closing.cardUsd > 0) b['punto-de-venta'] = { usd: closing.cardUsd, bs: closing.cardBs, count: 0 };
  if (closing.transferBs > 0 || closing.transferUsd > 0) b.transferencia = { usd: closing.transferUsd, bs: closing.transferBs, count: 0 };
  if (closing.mobileBs > 0 || closing.mobileUsd > 0) b['pago-movil'] = { usd: closing.mobileUsd, bs: closing.mobileBs, count: 0 };
  if (closing.checkBs > 0 || closing.checkUsd > 0) b.cheque = { usd: closing.checkUsd, bs: closing.checkBs, count: 0 };
  if (closing.zelleBs > 0 || closing.zelleUsd > 0) b.zelle = { usd: closing.zelleUsd, bs: closing.zelleBs, count: 0 };
  if (closing.usdtBs > 0 || closing.usdtUsd > 0) b.usdt = { usd: closing.usdtUsd, bs: closing.usdtBs, count: 0 };
  return b;
}

/**
 * Helper: calcula grupos de agrupacion desde el breakdown individual.
 */
function calcGroups(breakdown: Record<string, { usd: number; bs: number; count: number }>) {
  const get = (k: string) => breakdown[k] || { usd: 0, bs: 0, count: 0 };
  return {
    efectivoFisico: {
      bs: get('efectivo-bs').bs + get('efectivo').bs + get('efectivo-usd').bs,
      usd: get('efectivo-bs').usd + get('efectivo').usd + get('efectivo-usd').usd,
      subtotalBs: get('efectivo-bs').bs + get('efectivo').bs + get('efectivo-usd').bs,
      subtotalUsd: get('efectivo-bs').usd + get('efectivo').usd + get('efectivo-usd').usd,
      efectivoBs: { bs: get('efectivo-bs').bs + get('efectivo').bs, usd: get('efectivo-bs').usd + get('efectivo').usd },
      efectivoUsd: { bs: get('efectivo-usd').bs, usd: get('efectivo-usd').usd },
    },
    bsElectronicos: {
      bs: get('punto-de-venta').bs + get('transferencia').bs + get('pago-movil').bs,
      usd: get('punto-de-venta').usd + get('transferencia').usd + get('pago-movil').usd,
      puntoVenta: { bs: get('punto-de-venta').bs, usd: get('punto-de-venta').usd },
      transferencia: { bs: get('transferencia').bs, usd: get('transferencia').usd },
      pagoMovil: { bs: get('pago-movil').bs, usd: get('pago-movil').usd },
    },
    divisasDigitales: {
      bs: get('zelle').bs + get('usdt').bs,
      usd: get('zelle').usd + get('usdt').usd,
      zelle: { bs: get('zelle').bs, usd: get('zelle').usd },
      usdt: { bs: get('usdt').bs, usd: get('usdt').usd },
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const closingId = searchParams.get('closingId');
    const preview = searchParams.get('preview');

    // Preview: obtener estimado del cierre sin crearlo
    if (preview === 'true') {
      const previewDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);
      const pStart = new Date(previewDate);
      pStart.setHours(0, 0, 0, 0);
      const pEnd = new Date(previewDate);
      pEnd.setHours(23, 59, 59, 999);

      const sales = await db.sale.findMany({ where: { date: { gte: pStart, lte: pEnd } } });
      const devolutions = await db.devolution.findMany({ where: { date: { gte: pStart, lte: pEnd } } });

      const breakdown: Record<string, { usd: number; bs: number; count: number }> = {};
      const cashea = { usd: 0, bs: 0, count: 0 };
      sales.forEach((s) => classifySale(s, breakdown, cashea));
      const groups = calcGroups(breakdown);

      const totalSalesBs = sales.reduce((sum, s) => sum + (s.isCredit || s.paymentMethod === 'cashea' ? 0 : s.totalBs), 0);
      const totalSalesUsd = sales.reduce((sum, s) => sum + (s.isCredit || s.paymentMethod === 'cashea' ? 0 : s.total), 0);

      return NextResponse.json({
        breakdown,
        groups,
        totalSalesBs,
        totalSalesUsd,
        totalReturnsBs: devolutions.reduce((s, d) => s + d.totalBs, 0),
        creditSalesBs: sales.filter(s => s.isCredit).reduce((sum, s) => sum + s.totalBs, 0),
        casheaSalesBs: cashea.bs,
        casheaSalesUsd: cashea.usd,
        salesCount: sales.length,
      });
    }

    // Si se solicitan las ventas de un cierre especifico
    if (closingId) {
      const closing = await db.cashClosing.findUnique({ where: { id: closingId } });
      if (!closing) return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });

      let fromDate: Date;
      let toDate: Date;
      if (closing.closingType === 'pre') {
        fromDate = new Date(closing.date);
        toDate = new Date(closing.createdAt);
        toDate = new Date(toDate.getTime() + 2000);
      } else {
        const startOfDay = new Date(closing.date);
        startOfDay.setHours(0, 0, 0, 0);
        fromDate = startOfDay;
        toDate = new Date(closing.date);
        toDate.setHours(23, 59, 59, 999);
      }

      const sales = await db.sale.findMany({
        where: { date: { gte: fromDate, lte: toDate } },
        include: { items: { include: { product: { select: { id: true, name: true } } } } },
        orderBy: { date: 'desc' },
      });

      const referenceDetails = extractReferences(sales);
      const breakdown = rebuildLegacyBreakdown(closing);
      const groups = calcGroups(breakdown);

      // Role breakdown
      const ROLE_LABELS: Record<string, string> = { admin: "Administrador", cajero: "Cajero", vendedor: "Vendedor" };
      const roleBreakdown = sales.reduce((acc, s) => {
        const role = s.sellerRole || 'sin-rol';
        if (!acc[role]) acc[role] = { role, label: ROLE_LABELS[role] || role, salesCount: 0, totalUsd: 0, totalBs: 0 };
        acc[role].salesCount++; acc[role].totalUsd += s.total; acc[role].totalBs += s.totalBs;
        return acc;
      }, {} as Record<string, { role: string; label: string; salesCount: number; totalUsd: number; totalBs: number }>);

      return NextResponse.json({
        closing,
        sales,
        salesCount: sales.length,
        breakdown,
        groups,
        referenceDetails,
        roleBreakdown: Object.values(roleBreakdown).sort((a, b) => b.totalBs - a.totalBs),
      });
    }

    // Listado normal de cierres
    const closings = await db.cashClosing.findMany({
      where: {
        ...(startDate && endDate ? { date: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(closings);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener cierres de caja' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const date = body.date ? new Date(body.date) : new Date();
    const closingType = body.closingType || 'final';
    const sellerName = body.sellerName || '';
    const sellerRole = body.sellerRole || '';

    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    if (closingType === 'pre') {
      // ===== PRE-CIERRE =====
      const lastPreClosing = await db.cashClosing.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay }, closingType: 'pre' },
        orderBy: { createdAt: 'desc' },
      });

      const fromDate = lastPreClosing ? lastPreClosing.createdAt : startOfDay;
      const toDate = getVenezuelaNow();

      const sales = await db.sale.findMany({ where: { date: { gte: fromDate, lte: toDate } }, include: { items: true } });
      const devolutions = await db.devolution.findMany({ where: { date: { gte: fromDate, lte: toDate } } });

      const settings = await db.settings.findFirst();
      const rate = settings?.bcvRate || 36.50;

      const totalSalesUsd = sales.reduce((sum, s) => sum + (s.isCredit || s.paymentMethod === 'cashea' ? 0 : s.total), 0);
      const totalSalesBs = sales.reduce((sum, s) => sum + (s.isCredit || s.paymentMethod === 'cashea' ? 0 : s.totalBs), 0);
      const totalReturnsUsd = devolutions.reduce((sum, d) => sum + d.totalUsd, 0);
      const totalReturnsBs = devolutions.reduce((sum, d) => sum + d.totalBs, 0);

      const breakdown: Record<string, { usd: number; bs: number; count: number }> = {};
      const cashea = { usd: 0, bs: 0, count: 0 };
      sales.forEach((s) => classifySale(s, breakdown, cashea));
      const groups = calcGroups(breakdown);

      const creditSales = sales.filter(s => s.isCredit);
      const bdJson = buildBreakdownJson(breakdown);

      // Mantener columnas antiguas para compatibilidad con el frontend
      const get = (k: string) => breakdown[k] || { usd: 0, bs: 0, count: 0 };

      const closing = await db.cashClosing.create({
        data: {
          date: fromDate, closingType: 'pre', sellerName, sellerRole,
          totalSalesUsd, totalSalesBs,
          totalReturnsUsd, totalReturnsBs,
          netTotalUsd: totalSalesUsd - totalReturnsUsd,
          netTotalBs: totalSalesBs - totalReturnsBs,
          salesCount: sales.length, returnsCount: devolutions.length,
          cashUsd: get('efectivo').usd,
          cashBs: get('efectivo').bs,
          cardUsd: get('punto-de-venta').usd,
          cardBs: get('punto-de-venta').bs,
          transferUsd: get('transferencia').usd,
          transferBs: get('transferencia').bs,
          mobileUsd: get('pago-movil').usd,
          mobileBs: get('pago-movil').bs,
          checkUsd: get('cheque').usd,
          checkBs: get('cheque').bs,
          efectivoUsdUsd: get('efectivo-usd').usd,
          efectivoUsdBs: get('efectivo-usd').bs,
          zelleUsd: get('zelle').usd,
          zelleBs: get('zelle').bs,
          usdtUsd: get('usdt').usd,
          usdtBs: get('usdt').bs,
          creditSalesUsd: creditSales.reduce((sum, s) => sum + s.total, 0),
          creditSalesBs: creditSales.reduce((sum, s) => sum + s.totalBs, 0),
          creditSalesCount: creditSales.length,
          casheaSalesUsd: cashea.usd, casheaSalesBs: cashea.bs, casheaSalesCount: cashea.count,
          breakdownJson: bdJson,
          exchangeRate: rate,
          observations: body.observations || '',
        },
      });

      return NextResponse.json(closing);
    } else {
      // ===== CIERRE FINAL =====
      const sales = await db.sale.findMany({ where: { date: { gte: startOfDay, lte: endOfDay } }, include: { items: true } });
      const devolutions = await db.devolution.findMany({ where: { date: { gte: startOfDay, lte: endOfDay } } });

      const settings = await db.settings.findFirst();
      const rate = settings?.bcvRate || 36.50;

      const totalSalesUsd = sales.reduce((sum, s) => sum + (s.isCredit || s.paymentMethod === 'cashea' ? 0 : s.total), 0);
      const totalSalesBs = sales.reduce((sum, s) => sum + (s.isCredit || s.paymentMethod === 'cashea' ? 0 : s.totalBs), 0);
      const totalReturnsUsd = devolutions.reduce((sum, d) => sum + d.totalUsd, 0);
      const totalReturnsBs = devolutions.reduce((sum, d) => sum + d.totalBs, 0);

      const breakdown: Record<string, { usd: number; bs: number; count: number }> = {};
      const cashea = { usd: 0, bs: 0, count: 0 };
      sales.forEach((s) => classifySale(s, breakdown, cashea));

      const creditSales = sales.filter(s => s.isCredit);
      const bdJson = buildBreakdownJson(breakdown);
      const get = (k: string) => breakdown[k] || { usd: 0, bs: 0, count: 0 };

      const existingFinal = await db.cashClosing.findFirst({
        where: { date: { gte: startOfDay, lte: endOfDay }, closingType: 'final' },
      });

      const closingData = {
        totalSalesUsd, totalSalesBs,
        totalReturnsUsd, totalReturnsBs,
        netTotalUsd: totalSalesUsd - totalReturnsUsd,
        netTotalBs: totalSalesBs - totalReturnsBs,
        salesCount: sales.length, returnsCount: devolutions.length,
        cashUsd: get('efectivo').usd,
        cashBs: get('efectivo').bs,
        cardUsd: get('punto-de-venta').usd,
        cardBs: get('punto-de-venta').bs,
        transferUsd: get('transferencia').usd,
        transferBs: get('transferencia').bs,
        mobileUsd: get('pago-movil').usd,
        mobileBs: get('pago-movil').bs,
        checkUsd: get('cheque').usd,
        checkBs: get('cheque').bs,
        efectivoUsdUsd: get('efectivo-usd').usd,
        efectivoUsdBs: get('efectivo-usd').bs,
        zelleUsd: get('zelle').usd,
        zelleBs: get('zelle').bs,
        usdtUsd: get('usdt').usd,
        usdtBs: get('usdt').bs,
        creditSalesUsd: creditSales.reduce((sum, s) => sum + s.total, 0),
        creditSalesBs: creditSales.reduce((sum, s) => sum + s.totalBs, 0),
        creditSalesCount: creditSales.length,
        casheaSalesUsd: cashea.usd, casheaSalesBs: cashea.bs, casheaSalesCount: cashea.count,
        breakdownJson: bdJson,
        exchangeRate: rate,
        observations: body.observations || '',
        sellerName, sellerRole,
      };

      let closing;
      if (existingFinal) {
        closing = await db.cashClosing.update({ where: { id: existingFinal.id }, data: closingData });
      } else {
        closing = await db.cashClosing.create({ data: { date: startOfDay, closingType: 'final', ...closingData } });
      }

      return NextResponse.json(closing);
    }
  } catch (error) {
    console.error('Error creating cash closing:', error);
    return NextResponse.json({ error: 'Error al generar cierre de caja' }, { status: 500 });
  }
}
