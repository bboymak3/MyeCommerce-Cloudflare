export const runtime = 'edge';
import { createDbFromEnv, getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const { searchParams } = new URL(req.url);
    const userId = req.headers.get('x-user-id') || '';

    if (searchParams.get('current') === '1') {
      const shift = await db.cashShift.findFirst({ where: { userId, status: 'open' }, orderBy: { openedAt: 'desc' } });
      return NextResponse.json(shift);
    }

    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200);
    const shifts = await db.cashShift.findMany({ orderBy: { openedAt: 'desc' }, take: limit });
    return NextResponse.json(shifts);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener turnos de caja' }, { status: 500 });
  }
}

// Abrir un turno de caja
export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const body = await req.json() as any;
    const userId = req.headers.get('x-user-id') || '';
    const userName = req.headers.get('x-username') || '';
    const userRole = req.headers.get('x-user-role') || '';
    if (!userId) return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 });

    const existing = await db.cashShift.findFirst({ where: { userId, status: 'open' } });
    if (existing) return NextResponse.json({ error: 'Ya tiene un turno de caja abierto' }, { status: 400 });

    const openingCashUsd = parseFloat(body.openingCashUsd) || 0;
    const openingCashBs = parseFloat(body.openingCashBs) || 0;
    if (openingCashUsd < 0 || openingCashBs < 0) {
      return NextResponse.json({ error: 'El monto inicial no puede ser negativo' }, { status: 400 });
    }

    const shift = await db.cashShift.create({
      data: { userId, userName, userRole, openingCashUsd, openingCashBs, notes: body.notes || '' },
    });
    return NextResponse.json(shift);
  } catch (error: any) {
    return NextResponse.json({ error: `Error al abrir turno: ${error?.message || String(error)}` }, { status: 500 });
  }
}

// Cerrar un turno de caja
export async function PUT(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const body = await req.json() as any;
    const userId = req.headers.get('x-user-id') || '';
    if (!body.id) return NextResponse.json({ error: 'ID de turno requerido' }, { status: 400 });

    const shift = await db.cashShift.findUnique({ where: { id: body.id } });
    if (!shift) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    if (shift.status !== 'open') return NextResponse.json({ error: 'Este turno ya esta cerrado' }, { status: 400 });
    if (shift.userId !== userId) return NextResponse.json({ error: 'Solo el cajero que abrio el turno puede cerrarlo' }, { status: 403 });

    const sales = await db.sale.findMany({ where: { shiftId: shift.id } });
    let totalUsd = 0, totalBs = 0;
    let cashExpectedUsd = shift.openingCashUsd, cashExpectedBs = shift.openingCashBs;
    for (const s of sales) {
      totalUsd += s.total;
      totalBs += s.totalBs;
      if (s.paymentMethod === 'efectivo-usd') cashExpectedUsd += s.total;
      else if (s.paymentMethod === 'efectivo') cashExpectedBs += s.totalBs;
    }

    const closingCashUsd = parseFloat(body.closingCashUsd) || 0;
    const closingCashBs = parseFloat(body.closingCashBs) || 0;

    const updated = await db.cashShift.update({
      where: { id: shift.id },
      data: {
        closedAt: new Date(),
        closingCashUsd, closingCashBs,
        expectedCashUsd: Number(cashExpectedUsd.toFixed(2)),
        expectedCashBs: Number(cashExpectedBs.toFixed(2)),
        diffUsd: Number((closingCashUsd - cashExpectedUsd).toFixed(2)),
        diffBs: Number((closingCashBs - cashExpectedBs).toFixed(2)),
        salesCount: sales.length,
        totalUsd: Number(totalUsd.toFixed(2)),
        totalBs: Number(totalBs.toFixed(2)),
        status: 'closed',
        notes: body.notes || shift.notes,
      },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: `Error al cerrar turno: ${error?.message || String(error)}` }, { status: 500 });
  }
}
