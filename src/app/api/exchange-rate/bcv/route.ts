export const runtime = 'edge';
import { createDbFromEnv, getTenantId } from '@/lib/db';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { fetchBcvRate } from '@/lib/bcv-rate';

// GET /api/exchange-rate/bcv — solo consulta, no guarda nada (para mostrar
// el valor sugerido en Configuracion antes de aplicarlo).
export async function GET() {
  try {
    const { usd, fecha } = await fetchBcvRate();
    return NextResponse.json({ usd, fecha });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo obtener la tasa BCV' }, { status: 502 });
  }
}

// POST /api/exchange-rate/bcv — consulta y aplica de una vez a Configuracion
// (bcvRate). Usado por el boton "Actualizar tasa BCV" y por el cron diario.
export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const db = createDbFromEnv(env as any, tenantId);
  try {
    const { usd, fecha } = await fetchBcvRate();
    let settings = await db.settings.findFirst();
    if (!settings) {
      settings = await db.settings.create({ data: { bcvRate: usd, bcvSource: 'bcv-auto', bcvUpdatedAt: new Date() } });
    } else {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: { bcvRate: usd, bcvSource: 'bcv-auto', bcvUpdatedAt: new Date() },
      });
    }
    return NextResponse.json({ success: true, bcvRate: usd, fecha, settings });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo actualizar la tasa BCV' }, { status: 502 });
  }
}
