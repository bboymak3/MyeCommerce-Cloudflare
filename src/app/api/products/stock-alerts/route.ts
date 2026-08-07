import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const products = await db.product.findMany({
      where: { active: true, noStock: false },
      include: { category: true },
      orderBy: { stock: 'asc' },
    });

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