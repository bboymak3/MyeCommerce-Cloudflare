export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { toDbDate } from '@/lib/d1-batch';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { veDateKey, veDayStart, veDayEnd } from '@/lib/ve-time';

// Helper: desglosa venta en porciones netas (no-cashea) y cashea.
// Para pago mixto, solo suma la porcion correspondiente a cada bucket.
function desglosaVenta(s: { paymentMethod: string; total: number; totalBs: number; isCredit: boolean; mixedPaymentJson?: string | null }): { netUsd: number; netBs: number; casheaUsd: number; casheaBs: number } {
  if (s.isCredit) return { netUsd: 0, netBs: 0, casheaUsd: 0, casheaBs: 0 };
  const m = (s.paymentMethod || '').toLowerCase();
  if (m === 'cashea') return { netUsd: 0, netBs: 0, casheaUsd: s.total, casheaBs: s.totalBs };
  if (m === 'mixto' && s.mixedPaymentJson) {
    try {
      const entries = JSON.parse(s.mixedPaymentJson) as Array<{ method: string; amountBs: number; amountUsd: number }>;
      let netUsd = 0, netBs = 0, casheaUsd = 0, casheaBs = 0;
      for (const e of entries) {
        if (e.method.toLowerCase() === 'cashea') { casheaUsd += e.amountUsd || 0; casheaBs += e.amountBs; }
        else { netUsd += e.amountUsd || 0; netBs += e.amountBs; }
      }
      return { netUsd, netBs, casheaUsd, casheaBs };
    } catch { return { netUsd: s.total, netBs: s.totalBs, casheaUsd: 0, casheaBs: 0 }; }
  }
  return { netUsd: s.total, netBs: s.totalBs, casheaUsd: 0, casheaBs: 0 };
}

// Grafica de la semana: entradas netas y cashea por dia (hoy y los 6 dias anteriores)
function buildWeekDays(dayKey: (daysAgo: number) => string, rows: any[]) {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const weekMap: Record<string, { total: number; count: number; cashea: number; casheaCount: number }> = {};
  for (let i = 6; i >= 0; i--) weekMap[dayKey(i)] = { total: 0, count: 0, cashea: 0, casheaCount: 0 };
  for (const r of rows) {
    const key = veDateKey(r.date);
    if (!weekMap[key]) continue;
    const d = desglosaVenta({ paymentMethod: String(r.paymentMethod || ''), total: Number(r.total) || 0, totalBs: Number(r.totalBs) || 0, isCredit: !!r.isCredit, mixedPaymentJson: r.mixedPaymentJson });
    weekMap[key].total += d.netUsd;
    if (d.casheaUsd > 0 || d.casheaBs > 0) { weekMap[key].cashea += d.casheaUsd; weekMap[key].casheaCount++; }
    weekMap[key].count++;
  }
  return Object.entries(weekMap).map(([dateKey, data]) => ({ label: dayNames[new Date(dateKey + 'T12:00:00Z').getUTCDay()], ...data }));
}

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = (env as any).DB as D1Database;
  try {
    // Dias en hora de Venezuela (el servidor corre en UTC)
    const dayKey = (daysAgo: number) => veDateKey(Date.now() - daysAgo * 86400000);
    const todayKey = dayKey(0);
    const startOfDay = veDayStart(todayKey);
    const endOfDay = veDayEnd(todayKey);

    const yesterdayStart = veDayStart(dayKey(1));
    const yesterdayEnd = veDayEnd(dayKey(1));

    // ?week=1: solo la grafica de los ultimos 7 dias, que la pantalla pide cuando se abre.
    // La carga normal del dashboard trae solo hoy y ayer (48 horas).
    if (new URL(req.url).searchParams.get('week') === '1') {
      const weekStart = veDayStart(dayKey(6));
      const res = await D1.prepare(`SELECT date, total, totalBs, isCredit, paymentMethod, mixedPaymentJson
        FROM pos_sales WHERE tenant_id = ?1 AND date >= ?2 AND date <= ?3`)
        .bind(tenantId, toDbDate(weekStart), toDbDate(endOfDay)).all();
      return NextResponse.json({ weekDays: buildWeekDays(dayKey, (res.results || []) as any[]) });
    }

    // SQL directo en un solo lote de D1: el dashboard es la pantalla que mas se abre y con
    // Prisma (unos 3 ms de CPU por consulta) pasaba del limite de CPU del plan Free.
    // Sin la extension de Prisma no hay aislamiento automatico: todo filtra tenant_id = ?1.
    const range = (a: Date, b: Date) => [tenantId, toDbDate(a), toDbDate(b)];
    const [weekRes, topRes, itemCountRes, devRes, devCreditRes, abonoRes] = await D1.batch([
      D1.prepare(`SELECT id, date, total, totalBs, isCredit, paymentMethod, mixedPaymentJson, customerName
        FROM pos_sales WHERE tenant_id = ?1 AND date >= ?2 AND date <= ?3 ORDER BY date DESC`).bind(...range(yesterdayStart, endOfDay)),
      D1.prepare(`SELECT si.productId AS productId, COALESCE(p.name, 'Desconocido') AS name, SUM(si.quantity) AS qty, SUM(si.total) AS total
        FROM pos_sale_items si
        JOIN pos_sales s ON s.id = si.saleId AND s.tenant_id = ?1
        LEFT JOIN pos_products p ON p.id = si.productId AND p.tenant_id = ?1
        WHERE si.tenant_id = ?1 AND s.date >= ?2 AND s.date <= ?3
        GROUP BY si.productId ORDER BY qty DESC LIMIT 5`).bind(...range(startOfDay, endOfDay)),
      D1.prepare(`SELECT si.saleId AS saleId, COUNT(*) AS n
        FROM pos_sale_items si JOIN pos_sales s ON s.id = si.saleId AND s.tenant_id = ?1
        WHERE si.tenant_id = ?1 AND s.date >= ?2 AND s.date <= ?3 GROUP BY si.saleId`).bind(...range(startOfDay, endOfDay)),
      D1.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(totalUsd), 0) AS usd, COALESCE(SUM(totalBs), 0) AS bs
        FROM pos_devolutions WHERE tenant_id = ?1 AND date >= ?2 AND date <= ?3`).bind(...range(startOfDay, endOfDay)),
      // Parte de esas devoluciones descontada de deudas a credito (no salio dinero de la caja)
      D1.prepare(`SELECT COALESCE(SUM(amount), 0) AS usd, COALESCE(SUM(amountBs), 0) AS bs
        FROM pos_credit_payments WHERE tenant_id = ?1 AND method = 'devolucion' AND reference IN
          (SELECT id FROM pos_devolutions WHERE tenant_id = ?1 AND date >= ?2 AND date <= ?3)`).bind(...range(startOfDay, endOfDay)),
      D1.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS usd, COALESCE(SUM(amountBs), 0) AS bs
        FROM pos_credit_payments WHERE tenant_id = ?1 AND method <> 'devolucion' AND date >= ?2 AND date <= ?3`).bind(...range(startOfDay, endOfDay)),
    ]);

    const recentSales = ((weekRes.results || []) as any[]).map((r) => ({
      id: String(r.id),
      date: new Date(r.date),
      total: Number(r.total) || 0,
      totalBs: Number(r.totalBs) || 0,
      isCredit: !!r.isCredit,
      paymentMethod: String(r.paymentMethod || ''),
      mixedPaymentJson: r.mixedPaymentJson as string | null,
      customerName: String(r.customerName || ''),
    }));
    const todaySales = recentSales.filter(s => s.date >= startOfDay && s.date <= endOfDay);
    const itemCounts = new Map(((itemCountRes.results || []) as any[]).map((r) => [String(r.saleId), Number(r.n) || 0]));

    // Separar: ayer

    const yesterdaySales = recentSales.filter(s => s.date >= yesterdayStart && s.date <= yesterdayEnd);

    // ===== HOY =====
    // VENTAS BRUTAS: incluye TODO (efectivo, credito, cashea, etc.)
    const todayGrossUsd = todaySales.reduce((s, v) => s + v.total, 0);
    const todayGrossBs = todaySales.reduce((s, v) => s + v.totalBs, 0);

    // ENTRADAS NETAS: excluye credito y cashea (dinero que SI entra a caja hoy)
    // Para pago mixto, desglosa y solo suma la porcion no-cashea
    let todayTotalUsd = 0, todayTotalBs = 0;
    let todayCasheaCount = 0, todayCasheaUsd = 0, todayCasheaBs = 0;
    for (const v of todaySales) {
      const d = desglosaVenta(v);
      todayTotalUsd += d.netUsd;
      todayTotalBs += d.netBs;
      if (d.casheaUsd > 0 || d.casheaBs > 0) {
        todayCasheaCount++;
        todayCasheaUsd += d.casheaUsd;
        todayCasheaBs += d.casheaBs;
      }
    }

    const todayCount = todaySales.length;
    const todayAvgTicket = todayCount > 0 ? todayGrossUsd / todayCount : 0;

    // Credito
    const todayCreditCount = todaySales.filter(s => s.isCredit).length;
    const todayCreditUsd = todaySales.filter(s => s.isCredit).reduce((s, v) => s + v.total, 0);

    // Productos mas vendidos hoy (incluye TODAS las ventas, tambien cashea)
    const topProducts = ((topRes.results || []) as any[]).map((r) => ({
      name: String(r.name), qty: Number(r.qty) || 0, total: Number(r.total) || 0,
    }));

    // ===== COMPARACION CON AYER (entradas netas) =====
    const yesterdayTotal = yesterdaySales.reduce((s, v) => s + desglosaVenta(v).netUsd, 0);
    const yesterdayCount = yesterdaySales.length;
    const pctChange = yesterdayTotal > 0 ? ((todayTotalUsd - yesterdayTotal) / yesterdayTotal) * 100 : todayTotalUsd > 0 ? 100 : 0;

    // ===== METODOS DE PAGO HOY (excluir ventas a credito, desglosar mixtos, INCLUIR cashea) =====
    // paymentBreakdown: { count, totalUsd, totalBs } por metodo — para desglose explicito en dashboard
    const paymentBreakdown: Record<string, { count: number; totalUsd: number; totalBs: number }> = {};
    for (const sale of todaySales) {
      if (sale.isCredit) continue;
      const m = (sale.paymentMethod || 'efectivo').toLowerCase();
      if (m === 'mixto' && sale.mixedPaymentJson) {
        try {
          const entries = JSON.parse(sale.mixedPaymentJson) as Array<{ method: string; amountBs: number; amountUsd: number }>;
          entries.forEach((e) => {
            const me = e.method.toLowerCase();
            if (!paymentBreakdown[me]) paymentBreakdown[me] = { count: 0, totalUsd: 0, totalBs: 0 };
            paymentBreakdown[me].count++;
            paymentBreakdown[me].totalUsd += e.amountUsd || 0;
            paymentBreakdown[me].totalBs += e.amountBs;
          });
        } catch {
          if (!paymentBreakdown[m]) paymentBreakdown[m] = { count: 0, totalUsd: 0, totalBs: 0 };
          paymentBreakdown[m].count++;
          paymentBreakdown[m].totalUsd += sale.total;
          paymentBreakdown[m].totalBs += sale.totalBs;
        }
      } else {
        if (!paymentBreakdown[m]) paymentBreakdown[m] = { count: 0, totalUsd: 0, totalBs: 0 };
        paymentBreakdown[m].count++;
        paymentBreakdown[m].totalUsd += sale.total;
        paymentBreakdown[m].totalBs += sale.totalBs;
      }
    }

    // ===== DEVOLUCIONES Y ABONOS DE HOY =====
    const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
    const dev = ((devRes.results || [])[0] || {}) as any;
    const devCredit = ((devCreditRes.results || [])[0] || {}) as any;
    const todayReturns = {
      count: Number(dev.n) || 0,
      totalUsd: r2(dev.usd), totalBs: r2(dev.bs),
      creditUsd: r2(devCredit.usd), creditBs: r2(devCredit.bs),
      cashUsd: r2(Math.max(0, (Number(dev.usd) || 0) - (Number(devCredit.usd) || 0))),
      cashBs: r2(Math.max(0, (Number(dev.bs) || 0) - (Number(devCredit.bs) || 0))),
    };
    const ab = ((abonoRes.results || [])[0] || {}) as any;
    const todayAbonos = { count: Number(ab.n) || 0, usd: r2(ab.usd), bs: r2(ab.bs) };

    // ===== ULTIMAS 5 VENTAS =====
    const recentSalesList = todaySales.slice(0, 5).map(s => ({
      id: s.id,
      time: s.date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }),
      customer: s.customerName || 'Cliente Final',
      total: s.total,
      totalBs: s.totalBs,
      method: s.paymentMethod,
      isCredit: s.isCredit,
      isCashea: !s.isCredit && s.paymentMethod === 'cashea',
      itemCount: itemCounts.get(s.id) || 0,
    }));

    return NextResponse.json({
      today: {
        grossUsd: todayGrossUsd,
        grossBs: todayGrossBs,
        totalUsd: todayTotalUsd,  // entradas netas (sin cashea, sin credito)
        totalBs: todayTotalBs,
        count: todayCount,
        avgTicket: todayAvgTicket,
        creditCount: todayCreditCount,
        creditUsd: todayCreditUsd,
        casheaCount: todayCasheaCount,
        casheaUsd: todayCasheaUsd,
        casheaBs: todayCasheaBs,
        returns: todayReturns,
        abonos: { count: todayAbonos.count, usd: todayAbonos.usd, bs: todayAbonos.bs },
      },
      yesterday: {
        totalUsd: yesterdayTotal,
        count: yesterdayCount,
      },
      pctChange,
      topProducts,
      paymentBreakdown,
      recentSales: recentSalesList,
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Error al cargar dashboard' }, { status: 500 });
  }
}
