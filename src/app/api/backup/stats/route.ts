export const runtime = 'edge';
import { db as _defaultDb, createDbFromEnv } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextResponse } from 'next/server';
import { getAppVersion } from '@/lib/version';

export async function GET() {
  let db = _defaultDb; try { const { env } = getRequestContext(); db = createDbFromEnv(env as any); } catch {}
  try {
    const [products, categories, clients, sales, users, devolutions, cashClosings] = await Promise.all([
      db.product.count(),
      db.category.count(),
      db.client.count(),
      db.sale.count(),
      db.user.count(),
      db.devolution.count(),
      db.cashClosing.count(),
    ]);

    return NextResponse.json({
      version: getAppVersion(),
      products,
      categories,
      clients,
      sales,
      users,
      devolutions,
      cashClosings,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Error al obtener estadisticas' }, { status: 500 });
  }
}
