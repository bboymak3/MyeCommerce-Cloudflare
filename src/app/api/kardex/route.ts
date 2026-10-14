export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { toDbDate } from '@/lib/d1-batch';
import { d1Of, selectRows } from '@/lib/d1-read';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { veDayStart, veDayEnd } from '@/lib/ve-time';

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  // Sin Prisma: SQL directo (ver "Limite de CPU" en CLAUDE.md)
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 1000);

    if (!productId) {
      return NextResponse.json({ error: 'productId es requerido' }, { status: 400 });
    }

    // Filtro de fechas
    const conds: string[] = [];
    const params: unknown[] = [];
    if (startDate) { params.push(toDbDate(veDayStart(startDate))); conds.push(`AND date >= ?${params.length + 2}`); }
    if (endDate) { params.push(toDbDate(veDayEnd(endDate))); conds.push(`AND date <= ?${params.length + 2}`); }

    // Movimientos en orden cronologico
    const movements = await selectRows<any>(D1, 'pos_inventory_movements',
      `SELECT * FROM pos_inventory_movements WHERE tenant_id = ?1 AND productId = ?2 ${conds.join(' ')} ORDER BY date ASC, rowid ASC`,
      tenantId, productId, ...params);

    if (movements.length === 0) {
      return NextResponse.json({
        movements: [],
        summary: {
          initialBalance: { qty: 0, totalCost: 0, avgCost: 0 },
          finalBalance: { qty: 0, totalCost: 0, avgCost: 0 },
          totalEntries: 0,
          totalExits: 0,
        },
        message: 'No se encontraron movimientos para este producto en el rango seleccionado',
      });
    }

    // Calculate summary
    const entryTypes = ['compra', 'devolucion', 'ajuste_entrada'];
    const exitTypes = ['venta', 'ajuste_salida', 'merma', 'nota_entrega'];

    let totalEntries = 0;
    let totalExits = 0;

    for (const m of movements) {
      if (entryTypes.includes(m.movementType)) {
        totalEntries += m.absQuantity;
      } else if (exitTypes.includes(m.movementType)) {
        totalExits += m.absQuantity;
      }
    }

    const firstMovement = movements[0];
    const lastMovement = movements[movements.length - 1];

    // Initial balance: the balance BEFORE the first movement
    const initialBalance = {
      qty: sf(firstMovement.balanceQty - firstMovement.quantity),
      totalCost: sf(firstMovement.balanceTotalCost - firstMovement.totalCost),
      avgCost: sf(firstMovement.balanceAvgCost),
    };

    const finalBalance = {
      qty: sf(lastMovement.balanceQty),
      totalCost: sf(lastMovement.balanceTotalCost),
      avgCost: sf(lastMovement.balanceAvgCost),
    };

    // Pagination (slice from movements since they're all fetched)
    const skip = (page - 1) * limit;
    const paginatedMovements = movements.slice(skip, skip + limit);
    const totalPages = Math.ceil(movements.length / limit);

    return NextResponse.json({
      movements: paginatedMovements,
      pagination: {
        page,
        limit,
        total: movements.length,
        totalPages,
      },
      summary: {
        initialBalance,
        finalBalance,
        totalEntries: sf(totalEntries),
        totalExits: sf(totalExits),
      },
    });
  } catch (error) {
    console.error('Error fetching kardex:', error);
    return NextResponse.json({ error: 'Error al obtener kardex' }, { status: 500 });
  }
}
