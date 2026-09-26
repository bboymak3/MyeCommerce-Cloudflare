export const runtime = 'edge';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { fetchBcvRate } from '@/lib/bcv-rate';

// POST /api/cron/bcv-rate — actualiza la tasa BCV de TODOS los negocios que
// tengan bcvAutoUpdate activado. Pensado para un disparador externo diario
// (ver .github/workflows/bcv-daily-update.yml), no para el navegador: exige
// el secreto CRON_SECRET en la cabecera x-cron-secret. Esta ruta es publica
// en el middleware (sin sesion); el secreto es la unica proteccion.
export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const secret = (env as any).CRON_SECRET as string | undefined;
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = (env as any).DB as D1Database | undefined;
  if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  let usd: number, fecha: string;
  try {
    ({ usd, fecha } = await fetchBcvRate());
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo obtener la tasa BCV' }, { status: 502 });
  }

  let updated: Array<{ id: string; tenant_id: string }> = [];
  try {
    const { results } = await db
      .prepare('SELECT id, tenant_id FROM pos_settings WHERE bcvAutoUpdate = 1')
      .all<{ id: string; tenant_id: string }>();
    updated = results || [];
    const now = new Date().toISOString();
    for (const row of updated) {
      await db
        .prepare('UPDATE pos_settings SET bcvRate = ?, bcvSource = ?, bcvUpdatedAt = ? WHERE id = ?')
        .bind(usd, 'bcv-auto', now, row.id)
        .run();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error al actualizar los negocios' }, { status: 500 });
  }

  return NextResponse.json({ success: true, usd, fecha, updatedTenants: updated.length });
}
