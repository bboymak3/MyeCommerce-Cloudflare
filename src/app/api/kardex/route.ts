import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

export async function GET(req: NextRequest) {
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

    // Build date filter
    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.date = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59'),
      };
    } else if (startDate) {
      dateFilter.date = { gte: new Date(startDate) };
    } else if (endDate) {
      dateFilter.date = { lte: new Date(endDate + 'T23:59:59') };
    }

    // Fetch movements in chronological order
    const movements = await db.inventoryMovement.findMany({
      where: {
        productId,
        ...dateFilter,
      },
      orderBy: { date: 'asc' },
    });

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
