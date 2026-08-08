import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function getVenezuelaNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 4 * 3600000);
}

function getPeriodDates(period: string): { start: Date; end: Date; label: string } {
  const now = getVenezuelaNow();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'today':
      return { start: startOfDay, end: endOfDay, label: 'Hoy' };

    case 'yesterday': {
      const yStart = new Date(startOfDay);
      yStart.setDate(yStart.getDate() - 1);
      const yEnd = new Date(endOfDay);
      yEnd.setDate(yEnd.getDate() - 1);
      return { start: yStart, end: yEnd, label: 'Ayer' };
    }

    case 'week': {
      const wStart = new Date(startOfDay);
      wStart.setDate(wStart.getDate() - wStart.getDay());
      return { start: wStart, end: endOfDay, label: 'Esta Semana' };
    }

    case 'lastWeek': {
      const lwStart = new Date(startOfDay);
      lwStart.setDate(lwStart.getDate() - lwStart.getDay() - 7);
      const lwEnd = new Date(lwStart);
      lwEnd.setDate(lwEnd.getDate() + 6);
      lwEnd.setHours(23, 59, 59, 999);
      return { start: lwStart, end: lwEnd, label: 'Semana Pasada' };
    }

    case 'month':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: endOfDay,
        label: 'Este Mes',
      };

    case 'lastMonth': {
      const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: lmStart, end: lmEnd, label: 'Mes Pasado' };
    }

    case 'fortnight1': {
      const dayOfMonth = now.getDate();
      if (dayOfMonth <= 15) {
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59, 999),
          label: 'Quincena 1 (1-15)',
        };
      }
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 16),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        label: 'Quincena 2 (16-fin)',
      };
    }

    case 'fortnight1_1':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59, 999),
        label: 'Quincena 1 (1-15)',
      };

    case 'fortnight2':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 16),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        label: 'Quincena 2 (16-fin)',
      };

    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: new Date(now.getFullYear(), qMonth, 1),
        end: endOfDay,
        label: 'Este Trimestre',
      };
    }

    case 'lastQuarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: new Date(now.getFullYear(), qMonth - 3, 1),
        end: new Date(now.getFullYear(), qMonth, 0, 23, 59, 59, 999),
        label: 'Trimestre Pasado',
      };
    }

    case 'semester': {
      if (now.getMonth() < 6) {
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: endOfDay,
          label: 'Primer Semestre',
        };
      }
      return {
        start: new Date(now.getFullYear(), 6, 1),
        end: endOfDay,
        label: 'Segundo Semestre',
      };
    }

    case 'lastSemester': {
      if (now.getMonth() < 6) {
        return {
          start: new Date(now.getFullYear() - 1, 6, 1),
          end: new Date(now.getFullYear(), 0, 0, 23, 59, 59, 999),
          label: 'Semestre Pasado',
        };
      }
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 5, 30, 23, 59, 59, 999),
        label: 'Semestre Pasado',
      };
    }

    case 'year':
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: endOfDay,
        label: 'Este Ano',
      };

    case 'lastYear': {
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
        label: 'Ano Pasado',
      };
    }

    default: {
      // Custom: use startDate and endDate from query params
      return { start: startOfDay, end: endOfDay, label: 'Personalizado' };
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'today';
    const customStart = searchParams.get('startDate');
    const customEnd = searchParams.get('endDate');
    const sellerFilter = searchParams.get('seller') || '';
    const roleFilter = searchParams.get('role') || '';

    // Determine date range
    let start: Date;
    let end: Date;
    let periodLabel: string;

    if (period === 'custom' && customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd + 'T23:59:59.999');
      const fmt = (d: Date) => d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      periodLabel = `${fmt(start)} al ${fmt(end)}`;
    } else if (customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd + 'T23:59:59.999');
      const fmt = (d: Date) => d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      periodLabel = `${fmt(start)} al ${fmt(end)}`;
    } else {
      const periodInfo = getPeriodDates(period);
      start = periodInfo.start;
      end = periodInfo.end;
      periodLabel = periodInfo.label;
    }

    // Build where clause
    const dateFilter = { date: { gte: start, lte: end } };
    const whereClause: any = { ...dateFilter };
    if (sellerFilter) whereClause.sellerName = sellerFilter;
    if (roleFilter) whereClause.sellerRole = roleFilter;

    // Fetch sales
    const sales = await db.sale.findMany({
      where: whereClause,
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
      orderBy: { date: 'desc' },
    });

    // VENTAS BRUTAS: incluye TODO (efectivo, credito, cashea, mixto, etc.)
    const grossTotalSales = sales.reduce((sum, s) => sum + s.total, 0);
    const grossTotalBs = sales.reduce((sum, s) => sum + s.totalBs, 0);

    // Helper: desglosa venta en porcion neta (no-cashea) y cashea
    function desglosa(s: { paymentMethod: string; total: number; totalBs: number; isCredit: boolean; mixedPaymentJson?: string | null }): { netUsd: number; netBs: number; casheaUsd: number; casheaBs: number } {
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

    // ENTRADAS NETAS: excluye credito y cashea (dinero que SI entra a caja en el periodo)
    // Para pago mixto, desglosa y solo suma la porcion no-cashea
    let totalSales = 0, totalBs = 0;
    for (const s of sales) {
      const d = desglosa(s);
      totalSales += d.netUsd;
      totalBs += d.netBs;
    }

    // Credit breakdown - use settings BCV rate for accurate Bs conversion
    const settings = await db.settings.findFirst();
    const currentBcvRate = settings?.bcvRate || 36.5;
    const creditSales = sales.filter(s => s.isCredit);
    const creditSalesTotal = creditSales.reduce((sum, s) => sum + s.total, 0);
    const creditSalesTotalBs = creditSales.reduce((sum, s) => sum + s.totalBs, 0);
    const creditPaidTotal = creditSales.reduce((sum, s) => sum + (s.creditPaid || 0), 0);
    const creditPaidBs = parseFloat((creditPaidTotal * currentBcvRate).toFixed(2));
    const creditPendingTotal = creditSalesTotal - creditPaidTotal;
    const creditPendingBs = parseFloat((creditPendingTotal * currentBcvRate).toFixed(2));

    // Cashea (BNPL: Compra Ahora y Paga Despues)
    // El dinero NO entra a caja en el momento de la venta: Cashea lo transfiere despues desde la app.
    // Por eso se contabiliza en Ventas Brutas pero se excluye de Entradas Netas.
    // Para pago mixto, solo cuenta la porcion cashea (no el total completo).
    let casheaSalesCount = 0, casheaSalesTotal = 0, casheaSalesTotalBs = 0;
    for (const s of sales) {
      if (s.isCredit) continue;
      const d = desglosa(s);
      if (d.casheaUsd > 0 || d.casheaBs > 0) {
        casheaSalesCount++;
        casheaSalesTotal += d.casheaUsd;
        casheaSalesTotalBs += d.casheaBs;
      }
    }

    // Payment breakdown — desglosa mixto en metodos individuales
    const paymentBreakdown: Record<string, { count: number; totalUsd: number; totalBs: number }> = {};
    sales.forEach((s) => {
      if (s.isCredit) {
        if (!paymentBreakdown['credito']) paymentBreakdown['credito'] = { count: 0, totalUsd: 0, totalBs: 0 };
        paymentBreakdown['credito'].count++;
        paymentBreakdown['credito'].totalUsd += s.total;
        paymentBreakdown['credito'].totalBs += s.totalBs;
        return;
      }
      if (s.paymentMethod === 'mixto' && s.mixedPaymentJson) {
        try {
          const entries = JSON.parse(s.mixedPaymentJson) as Array<{ method: string; amountBs: number; amountUsd: number }>;
          entries.forEach((e) => {
            const m = e.method.toLowerCase();
            if (!paymentBreakdown[m]) paymentBreakdown[m] = { count: 0, totalUsd: 0, totalBs: 0 };
            paymentBreakdown[m].totalUsd += e.amountUsd || 0;
            paymentBreakdown[m].totalBs += e.amountBs;
          });
        } catch {
          // Si no se puede parsear, agrupar como mixto
          if (!paymentBreakdown['mixto']) paymentBreakdown['mixto'] = { count: 0, totalUsd: 0, totalBs: 0 };
          paymentBreakdown['mixto'].count++;
          paymentBreakdown['mixto'].totalUsd += s.total;
          paymentBreakdown['mixto'].totalBs += s.totalBs;
        }
      } else {
        const m = s.paymentMethod || 'efectivo';
        if (!paymentBreakdown[m]) paymentBreakdown[m] = { count: 0, totalUsd: 0, totalBs: 0 };
        paymentBreakdown[m].count++;
        paymentBreakdown[m].totalUsd += s.total;
        paymentBreakdown[m].totalBs += s.totalBs;
      }
    });

    // Top products
    const productMap: Record<string, { name: string; quantity: number; total: number }> = {};
    sales.forEach((s) => {
      s.items.forEach((item) => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = { name: item.product?.name || 'Producto eliminado', quantity: 0, total: 0 };
        }
        productMap[item.productId].quantity += item.quantity;
        productMap[item.productId].total += item.total;
      });
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.total - a.total).slice(0, 10);

    // References detail
    const referenceDetails: Array<{
      saleId: string;
      date: string;
      paymentType: string;
      reference: string;
      totalBs: number;
      totalUsd: number;
      customerName: string;
      saleTime: string;
    }> = [];

    sales.forEach((s) => {
      const saleDate = new Date(s.date).toLocaleString("es-VE", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
      const refMethods = ['transferencia', 'pago-movil', 'zelle', 'usdt'];
      const refLabels: Record<string, string> = { transferencia: 'Transferencia', 'pago-movil': 'Pago Movil', zelle: 'Zelle', usdt: 'USDT' };
      if (refMethods.includes(s.paymentMethod)) {
        referenceDetails.push({
          saleId: s.id, date: new Date(s.date).toISOString(),
          paymentType: refLabels[s.paymentMethod] || s.paymentMethod,
          reference: s.referenceNumber || 'Sin referencia', totalBs: s.totalBs, totalUsd: s.total,
          customerName: s.customerName || 'Cliente Final', saleTime: saleDate,
        });
      } else if (s.paymentMethod === 'mixto' && s.mixedPaymentJson) {
        try {
          const entries = JSON.parse(s.mixedPaymentJson) as Array<{
            method: string; amountBs: number; amountUsd: number; reference: string;
          }>;
          entries.forEach((entry) => {
            if (refMethods.includes(entry.method) && entry.amountBs > 0) {
              referenceDetails.push({
                saleId: s.id, date: new Date(s.date).toISOString(),
                paymentType: refLabels[entry.method] || entry.method,
                reference: entry.reference || 'Sin referencia', totalBs: entry.amountBs,
                totalUsd: entry.amountUsd || parseFloat((entry.amountBs / (s.exchangeRate || 36.5)).toFixed(2)),
                customerName: s.customerName || 'Cliente Final', saleTime: saleDate,
              });
            }
          });
        } catch {}
      }
    });

    const transferTotal = referenceDetails.filter(r => r.paymentType === 'Transferencia').reduce((sum, r) => sum + r.totalBs, 0);
    const mobileTotal = referenceDetails.filter(r => r.paymentType === 'Pago Movil').reduce((sum, r) => sum + r.totalBs, 0);
    const zelleTotalUsd = referenceDetails.filter(r => r.paymentType === 'Zelle').reduce((sum, r) => sum + r.totalUsd, 0);
    const usdtTotalUsd = referenceDetails.filter(r => r.paymentType === 'USDT').reduce((sum, r) => sum + r.totalUsd, 0);

    // ===== SELLER BREAKDOWN / RANKING (all sellers in period, without filters) =====
    const allSalesInPeriod = (sellerFilter || roleFilter)
      ? await db.sale.findMany({
          where: dateFilter,
          include: { items: { include: { product: { select: { id: true, name: true } } } } },
          orderBy: { date: 'desc' },
        })
      : sales;

    const ROLE_LABELS: Record<string, string> = {
      admin: "Administrador", cajero: "Cajero", vendedor: "Vendedor",
    };

    // Seller + role ranking
    const sellerMap: Record<string, {
      name: string; role: string; roleLabel: string;
      salesCount: number; totalUsd: number; totalBs: number; avgTicket: number;
    }> = {};

    allSalesInPeriod.forEach((s) => {
      const name = s.sellerName || 'Sin Vendedor';
      const role = s.sellerRole || '';
      const roleLabel = ROLE_LABELS[role] || '';
      if (!sellerMap[name]) {
        sellerMap[name] = { name, role, roleLabel, salesCount: 0, totalUsd: 0, totalBs: 0, avgTicket: 0 };
      }
      sellerMap[name].salesCount++;
      sellerMap[name].totalUsd += s.total;
      sellerMap[name].totalBs += s.totalBs;
      if (role) sellerMap[name].role = role;
      if (roleLabel) sellerMap[name].roleLabel = roleLabel;
    });

    Object.values(sellerMap).forEach((s) => {
      s.avgTicket = s.salesCount > 0 ? s.totalBs / s.salesCount : 0;
    });

    const sellerBreakdown = Object.values(sellerMap).sort((a, b) => b.totalBs - a.totalBs);
    const sellerList = [...new Set(allSalesInPeriod.map(s => s.sellerName || 'Sin Vendedor'))].sort();

    // Role breakdown
    const roleMap: Record<string, {
      role: string; label: string; salesCount: number; totalUsd: number; totalBs: number;
    }> = {};

    allSalesInPeriod.forEach((s) => {
      const role = s.sellerRole || 'sin-rol';
      const label = ROLE_LABELS[role] || role;
      if (!roleMap[role]) {
        roleMap[role] = { role, label, salesCount: 0, totalUsd: 0, totalBs: 0 };
      }
      roleMap[role].salesCount++;
      roleMap[role].totalUsd += s.total;
      roleMap[role].totalBs += s.totalBs;
    });

    const roleBreakdown = Object.values(roleMap).sort((a, b) => b.totalBs - a.totalBs);

    return NextResponse.json({
      sales,
      totalSales,
      totalBs,
      grossTotalSales,
      grossTotalBs,
      salesCount: sales.length,
      paymentBreakdown,
      topProducts,
      referenceDetails,
      transferTotal,
      mobileTotal,
      zelleTotalUsd,
      usdtTotalUsd,
      sellerBreakdown,
      sellerList,
      roleBreakdown,
      creditSalesCount: creditSales.length,
      creditSalesTotal,
      creditSalesTotalBs,
      creditPaidTotal,
      creditPaidBs,
      creditPendingTotal,
      creditPendingBs,
      casheaSalesCount,
      casheaSalesTotal,
      casheaSalesTotalBs,
      periodLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
