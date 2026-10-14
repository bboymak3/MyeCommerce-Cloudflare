export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { fromDbRow, toDbDate } from '@/lib/d1-batch';
import { d1Of, loadSalesWithItems, placeholders, selectRows } from '@/lib/d1-read';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { veDayStart, veDayEnd } from '@/lib/ve-time';

// GET — Reporte de Utilidad / Pérdida por periodo
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  // Sin Prisma: SQL directo (ver "Limite de CPU" en CLAUDE.md)
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Las fechas de inicio y fin son requeridas' }, { status: 400 });
    }

    const start = veDayStart(startDate);
    const end = veDayEnd(endDate);

    // Obtener tasa de cambio actual
    const settings: any = await D1.prepare('SELECT bcvRate FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId).first();
    const bcvRate = settings?.bcvRate || 36.5;
    const range = [toDbDate(start), toDbDate(end)];

    // 1. VENTAS del periodo
    const sales: any[] = await loadSalesWithItems(D1, tenantId, 'AND s.date >= ?2 AND s.date <= ?3', range, ['cost'], 's.rowid');

    const totalVentasUsd = sales.reduce((sum, s) => sum + s.total, 0);
    const totalVentasCount = sales.length;
    // Devoluciones hechas en el periodo (restan de las ventas, y su mercancia vuelve al inventario)
    const devolutions: any[] = await selectRows(D1, 'pos_devolutions',
      'SELECT * FROM pos_devolutions WHERE tenant_id = ?1 AND date >= ?2 AND date <= ?3 ORDER BY rowid', tenantId, ...range);
    if (devolutions.length) {
      const { results: devItems } = await D1.prepare(
        `SELECT di.devolutionId, di.quantity, p.cost AS cost, p.id AS pid FROM pos_devolution_items di
         LEFT JOIN pos_products p ON p.id = di.productId
         WHERE di.tenant_id = ?1 AND di.devolutionId IN (${placeholders(devolutions.length, 2)}) ORDER BY di.rowid`,
      ).bind(tenantId, ...devolutions.map((d) => d.id)).all();
      for (const d of devolutions) {
        d.items = ((devItems || []) as any[]).filter((i) => i.devolutionId === d.id)
          .map((i) => ({ quantity: i.quantity, product: i.pid ? { cost: i.cost } : null }));
      }
    }
    const totalDevolucionesUsd = devolutions.reduce((sum, d) => sum + (d.totalUsd || 0), 0);
    const costoDevueltoUsd = devolutions.reduce((sum, d) =>
      sum + (d.items || []).reduce((s: number, it: any) => s + (it.product?.cost || 0) * it.quantity, 0), 0);
    const ventasNetasUsd = totalVentasUsd - totalDevolucionesUsd;

    // 2. COSTO DE VENTAS (cost * qty de cada SaleItem)
    const costoDeVentasUsd = sales.reduce((sum, s) => {
      const itemsCost = s.items.reduce((itemSum, item) => {
        return itemSum + (item.product?.cost || 0) * item.quantity;
      }, 0);
      return sum + itemsCost;
    }, 0) - costoDevueltoUsd;

    // 3. GASTOS del periodo
    const { results: expenseRows } = await D1.prepare(
      `SELECT e.*, c.id AS _cid, c.name AS _cname, c.icon AS _cicon, c.color AS _ccolor
       FROM pos_expenses e LEFT JOIN pos_expense_categories c ON c.id = e.categoryId
       WHERE e.tenant_id = ?1 AND e.date >= ?2 AND e.date <= ?3 ORDER BY e.rowid`,
    ).bind(tenantId, ...range).all();
    const expenses = ((expenseRows || []) as any[]).map(({ _cid, _cname, _cicon, _ccolor, ...r }) => ({
      ...fromDbRow<any>('pos_expenses', r),
      category: { id: _cid, name: _cname, icon: _cicon, color: _ccolor },
    }));

    const totalGastosUsd = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 4. COMPRAS del periodo (inventario)
    const purchases = await selectRows<any>(D1, 'pos_purchases',
      'SELECT * FROM pos_purchases WHERE tenant_id = ?1 AND date >= ?2 AND date <= ?3 ORDER BY rowid', tenantId, ...range);
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
          // Pago mixto: lista de { method, amountUsd, amountBs }
          const mixed = JSON.parse(sale.mixedPaymentJson);
          if (!Array.isArray(mixed)) throw new Error('formato');
          for (const e of mixed) {
            const usd = Number(e.amountUsd) || (Number(e.amountBs) || 0) / (sale.exchangeRate || bcvRate);
            ventasPorMetodo[e.method] = (ventasPorMetodo[e.method] || 0) + usd;
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
