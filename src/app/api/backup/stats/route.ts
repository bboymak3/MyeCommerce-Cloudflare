export const runtime = 'edge';
import { createDbFromEnv, getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextResponse } from 'next/server';
import { getAppVersion } from '@/lib/version';

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
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
