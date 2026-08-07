import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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

export async function GET() {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Rango de los ultimos 8 dias (hoy + 7 dias atras para grafica semanal y ayer)
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    // ===== UNA SOLA CONSULTA: todas las ventas de los ultimos 7 dias =====
    const recentSales = await db.sale.findMany({
      where: { date: { gte: weekStart, lte: endOfDay } },
      include: { items: { include: { product: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
    });

    // Separar: ventas de hoy vs semana vs ayer
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);

    const todaySales = recentSales.filter(s => s.date >= startOfDay && s.date <= endOfDay);
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
    const productMap: Record<string, { name: string; qty: number; total: number }> = {};
    for (const sale of todaySales) {
      for (const item of sale.items) {
        const key = item.productId;
        if (!productMap[key]) productMap[key] = { name: item.product?.name || 'Desconocido', qty: 0, total: 0 };
        productMap[key].qty += item.quantity;
        productMap[key].total += item.total;
      }
    }
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // ===== SEMANA (ultimos 7 dias) - agrupado en memoria =====
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const weekMap: Record<string, { total: number; count: number; cashea: number; casheaCount: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      weekMap[key] = { total: 0, count: 0, cashea: 0, casheaCount: 0 };
    }
    for (const s of recentSales) {
      const key = s.date.toISOString().slice(0, 10);
      if (weekMap[key]) {
        const d = desglosaVenta(s);
        // Total = entradas netas (excluye cashea, excluye credito)
        weekMap[key].total += d.netUsd;
        // Cashea se registra aparte para mostrarlo apilado en el grafico
        if (d.casheaUsd > 0 || d.casheaBs > 0) {
          weekMap[key].cashea += d.casheaUsd;
          weekMap[key].casheaCount++;
        }
        weekMap[key].count++;
      }
    }
    const weekDays = Object.entries(weekMap).map(([dateKey, data]) => {
      const d = new Date(dateKey + 'T12:00:00');
      return { label: dayNames[d.getDay()], ...data };
    });

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

    // ===== ULTIMAS 5 VENTAS =====
    const recentSalesList = todaySales.slice(0, 5).map(s => ({
      id: s.id,
      time: s.date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      customer: s.customerName || 'Cliente Final',
      total: s.total,
      totalBs: s.totalBs,
      method: s.paymentMethod,
      isCredit: s.isCredit,
      isCashea: !s.isCredit && s.paymentMethod === 'cashea',
      itemCount: s.items.length,
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
      },
      yesterday: {
        totalUsd: yesterdayTotal,
        count: yesterdayCount,
      },
      pctChange,
      weekDays,
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
