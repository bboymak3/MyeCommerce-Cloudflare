import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET — Reporte de Utilidad / Pérdida por periodo
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Las fechas de inicio y fin son requeridas' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59.999');

    // Obtener tasa de cambio actual
    const settings = await db.settings.findFirst();
    const bcvRate = settings?.bcvRate || 36.5;

    // 1. VENTAS del periodo
    const sales = await db.sale.findMany({
      where: { date: { gte: start, lte: end } },
      include: { items: { include: { product: { select: { cost: true } } } } },
    });

    const totalVentasUsd = sales.reduce((sum, s) => sum + s.total, 0);
    const totalVentasCount = sales.length;
    const totalDevolucionesUsd = sales.reduce((sum, s) => {
      const devTotal = s.devolutions?.reduce((d, dev) => d + dev.totalUsd, 0) || 0;
      return sum + devTotal;
    }, 0);
    const ventasNetasUsd = totalVentasUsd - totalDevolucionesUsd;

    // 2. COSTO DE VENTAS (cost * qty de cada SaleItem)
    const costoDeVentasUsd = sales.reduce((sum, s) => {
      const itemsCost = s.items.reduce((itemSum, item) => {
        return itemSum + (item.product?.cost || 0) * item.quantity;
      }, 0);
      return sum + itemsCost;
    }, 0);

    // 3. GASTOS del periodo
    const expenses = await db.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    });

    const totalGastosUsd = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 4. COMPRAS del periodo (inventario)
    const purchases = await db.purchase.findMany({
      where: { date: { gte: start, lte: end } },
    });
    const totalComprasUsd = purchases.reduce((sum, p) => sum + p.totalUsd, 0);

    // 5. Cálculos
    const utilidadBruta = ventasNetasUsd - costoDeVentasUsd;
    const utilidadNeta = utilidadBruta - totalGastosUsd;
    const margenBrusto = ventasNetasUsd > 0 ? (utilidadBruta / ventasNetasUsd) * 100 : 0;
    const margenNeto = ventasNetasUsd > 0 ? (utilidadNeta / ventasNetasUsd) * 100 : 0;

    // 6. Desglose de gastos por categoría
    const gastosPorCategoria: Record<string, { name: string; icon: string; color: string; totalUsd: number; totalBs: number; count: number }> = {};
    for (const exp of expenses) {
      const catId = exp.categoryId;
      if (!gastosPorCategoria[catId]) {
        gastosPorCategoria[catId] = {
          name: exp.category.name,
          icon: exp.category.icon,
          color: exp.category.color,
          totalUsd: 0,
          totalBs: 0,
          count: 0,
        };
      }
      gastosPorCategoria[catId].totalUsd += exp.amount;
      gastosPorCategoria[catId].totalBs += exp.amountBs;
      gastosPorCategoria[catId].count += 1;
    }

    // 7. Desglose por método de pago de gastos
    const gastosPorMetodo: Record<string, number> = {};
    for (const exp of expenses) {
      const method = exp.paymentMethod;
      gastosPorMetodo[method] = (gastosPorMetodo[method] || 0) + exp.amount;
    }

    // 8. Ventas por método de pago
    const ventasPorMetodo: Record<string, number> = {};
    for (const sale of sales) {
      // Parsear mixedPaymentJson si existe
      if (sale.mixedPaymentJson && sale.mixedPaymentJson !== '{}' && sale.mixedPaymentJson !== '') {
        try {
          const mixed = JSON.parse(sale.mixedPaymentJson);
          for (const [method, amount] of Object.entries(mixed)) {
            ventasPorMetodo[method] = (ventasPorMetodo[method] || 0) + (amount as number);
          }
        } catch {
          ventasPorMetodo[sale.paymentMethod] = (ventasPorMetodo[sale.paymentMethod] || 0) + sale.total;
        }
      } else {
        ventasPorMetodo[sale.paymentMethod] = (ventasPorMetodo[sale.paymentMethod] || 0) + sale.total;
      }
    }

    return NextResponse.json({
      period: { startDate, endDate },
      exchangeRate: bcvRate,
      ventas: {
        totalUsd: Math.round(totalVentasUsd * 100) / 100,
        totalBs: Math.round(totalVentasUsd * bcvRate * 100) / 100,
        count: totalVentasCount,
        devolucionesUsd: Math.round(totalDevolucionesUsd * 100) / 100,
        netasUsd: Math.round(ventasNetasUsd * 100) / 100,
        netasBs: Math.round(ventasNetasUsd * bcvRate * 100) / 100,
        porMetodo: ventasPorMetodo,
      },
      costoVentas: {
        totalUsd: Math.round(costoDeVentasUsd * 100) / 100,
        totalBs: Math.round(costoDeVentasUsd * bcvRate * 100) / 100,
      },
      compras: {
        totalUsd: Math.round(totalComprasUsd * 100) / 100,
        totalBs: Math.round(totalComprasUsd * bcvRate * 100) / 100,
      },
      gastos: {
        totalUsd: Math.round(totalGastosUsd * 100) / 100,
        totalBs: Math.round(totalGastosUsd * bcvRate * 100) / 100,
        count: expenses.length,
        porCategoria: Object.values(gastosPorCategoria),
        porMetodo: gastosPorMetodo,
      },
      utilidad: {
        brutaUsd: Math.round(utilidadBruta * 100) / 100,
        brutaBs: Math.round(utilidadBruta * bcvRate * 100) / 100,
        netaUsd: Math.round(utilidadNeta * 100) / 100,
        netaBs: Math.round(utilidadNeta * bcvRate * 100) / 100,
        margenBrutoPct: Math.round(margenBrusto * 100) / 100,
        margenNetoPct: Math.round(margenNeto * 100) / 100,
        esPerdida: utilidadNeta < 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al generar reporte de utilidad: ' + (error.message || '') }, { status: 500 });
  }
}
