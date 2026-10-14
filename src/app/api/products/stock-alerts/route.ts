export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    // SQL directo (se pide al abrir la app; ver "Limite de CPU" en CLAUDE.md)
    const { results } = await (env as any).DB.prepare(
      `SELECT p.id, p.name, p.barcode, p.stock, p.minStock, p.price, p.cost, p.icon, c.name AS categoryName
       FROM pos_products p LEFT JOIN pos_categories c ON c.id = p.categoryId
       WHERE p.tenant_id = ?1 AND p.active = 1 AND p.noStock = 0 ORDER BY p.stock ASC`
    ).bind(tenantId).all();
    const products = (results as any[]).map((r) => ({ ...r, category: r.categoryName != null ? { name: r.categoryName } : null }));

    const zeroStock: any[] = [];
    const lowStock: any[] = [];

    for (const p of products) {
      const entry = {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        stock: p.stock,
        minStock: p.minStock,
        price: p.price,
        cost: p.cost,
        icon: p.icon,
        categoryName: p.category?.name || '',
        deficit: p.minStock - p.stock,
      };

      if (p.stock <= 0) {
        zeroStock.push(entry);
      } else if (p.stock <= p.minStock) {
        lowStock.push(entry);
      }
    }

    return NextResponse.json({
      totalAlerts: zeroStock.length + lowStock.length,
      zeroStockCount: zeroStock.length,
      lowStockCount: lowStock.length,
      zeroStock,
      lowStock,
    });
  } catch (error: any) {
    console.error('Stock alerts error:', error);
    return NextResponse.json({ error: 'Error al consultar alertas de stock' }, { status: 500 });
  }
}