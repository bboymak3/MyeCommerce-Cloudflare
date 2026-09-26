export const runtime = 'edge';
import { createDbFromEnv, getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

const VELOCITY_DAYS = 30;
const REORDER_DAYS = 14; // cuantos dias de venta cubrir con la sugerencia

// Sugerencias de reposicion: productos en/bajo su stock minimo, con la cantidad
// sugerida (segun ritmo de venta de los ultimos 30 dias) y el proveedor mas
// reciente conocido para cada uno (deducido de sus compras anteriores).
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    // Prisma no permite comparar dos columnas en `where` directamente (stock <= minStock)
    // sin SQL crudo; se trae todo lo activo (normalmente pocos cientos de productos
    // en este tipo de negocio) y se filtra en JS.
    const allActive = await db.product.findMany({ where: { active: true, noStock: false } });
    const low = allActive.filter((p) => p.stock <= p.minStock);
    if (low.length === 0) {
      return NextResponse.json({ suppliers: [], unassigned: [] });
    }
    const productIds = low.map((p) => p.id);

    const since = new Date();
    since.setDate(since.getDate() - VELOCITY_DAYS);
    const velocityRows = await db.inventoryMovement.groupBy({
      by: ['productId'],
      where: { movementType: 'venta', date: { gte: since }, productId: { in: productIds } },
      _sum: { absQuantity: true },
    });
    const velocityByProduct = new Map<string, number>();
    for (const row of velocityRows as any[]) {
      velocityByProduct.set(row.productId, (row._sum?.absQuantity || 0) / VELOCITY_DAYS);
    }

    // Proveedor mas reciente por producto, segun sus compras anteriores
    const recentItems = await db.purchaseItem.findMany({
      where: { productId: { in: productIds } },
      include: { purchase: { select: { supplierId: true, date: true, supplier: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    const supplierByProduct = new Map<string, { id: string; name: string } | null>();
    for (const item of recentItems as any[]) {
      if (!item.productId || supplierByProduct.has(item.productId)) continue;
      const s = item.purchase?.supplier;
      supplierByProduct.set(item.productId, s ? { id: s.id, name: s.name } : null);
    }

    const suggestions = low.map((p) => {
      const velocity = velocityByProduct.get(p.id) || 0;
      const deficit = Math.max(0, p.minStock - p.stock);
      const byVelocity = Math.ceil(velocity * REORDER_DAYS);
      const suggestedQty = Math.max(deficit, byVelocity, p.stock <= 0 ? Math.max(p.minStock, 1) : 0);
      const supplier = supplierByProduct.get(p.id) || null;
      return {
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        stock: p.stock,
        minStock: p.minStock,
        cost: p.cost,
        suggestedQty: Math.max(1, Math.round(suggestedQty)),
        supplierId: supplier?.id || null,
        supplierName: supplier?.name || null,
      };
    });

    const bySupplier = new Map<string, { supplierId: string; supplierName: string; items: typeof suggestions }>();
    const unassigned: typeof suggestions = [];
    for (const s of suggestions) {
      if (!s.supplierId) { unassigned.push(s); continue; }
      const key = s.supplierId;
      if (!bySupplier.has(key)) bySupplier.set(key, { supplierId: s.supplierId, supplierName: s.supplierName!, items: [] });
      bySupplier.get(key)!.items.push(s);
    }

    return NextResponse.json({
      suppliers: Array.from(bySupplier.values()),
      unassigned,
    });
  } catch (error: any) {
    console.error('Reorder suggestions error:', error);
    return NextResponse.json({ error: 'Error al calcular sugerencias de reposicion' }, { status: 500 });
  }
}
