export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { toDbDate } from '@/lib/d1-batch';
import { d1Of, loadSalesWithItems } from '@/lib/d1-read';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { veDayStart, veDayEnd } from '@/lib/ve-time';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';

    // SQL directo (ver "Limite de CPU" en CLAUDE.md)
    const args: unknown[] = [clientId];
    let where = 'AND s.clientId = ?2';
    if (dateFrom) { args.push(toDbDate(veDayStart(dateFrom))); where += ` AND s.date >= ?${args.length + 1}`; }
    if (dateTo) { args.push(toDbDate(veDayEnd(dateTo))); where += ` AND s.date <= ?${args.length + 1}`; }

    const sales = await loadSalesWithItems(d1Of(env), tenantId, where, args, ['name']);

    return NextResponse.json(sales);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}
