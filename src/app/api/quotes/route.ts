export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow, sqlExpr } from '@/lib/d1-batch';
import { d1Of, placeholders } from '@/lib/d1-read';

// Sin Prisma: SQL directo (ver "Limite de CPU" en CLAUDE.md)

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

/**
 * Presupuestos con sus items y, si se pide, el cliente (id, nombre, documento), como el
 * include de Prisma. `where` es SQL extra sobre pos_quotes con parametros desde ?2.
 */
async function loadQuotesSql(D1: D1Database, tenantId: string, where: string, params: unknown[], withClient: boolean, limitSql = '') {
  const { results } = await D1.prepare(`SELECT * FROM pos_quotes WHERE tenant_id = ?1 ${where} ORDER BY createdAt DESC ${limitSql}`)
    .bind(tenantId, ...params).all();
  const quotes = ((results || []) as any[]).map((r) => fromDbRow<any>('pos_quotes', r));
  if (quotes.length === 0) return [];
  const ids = quotes.map((q) => q.id);
  const clientIds = [...new Set(quotes.map((q) => q.clientId).filter(Boolean))] as string[];
  const [itemRes, cliRes] = await D1.batch([
    D1.prepare(`SELECT * FROM pos_quote_items WHERE tenant_id = ?1 AND quoteId IN (${placeholders(ids.length, 2)}) ORDER BY rowid`).bind(tenantId, ...ids),
    D1.prepare(`SELECT id, fullName, docType, docNumber FROM pos_clients WHERE tenant_id = ?1 AND id IN (${placeholders(Math.max(1, clientIds.length), 2)})`)
      .bind(tenantId, ...(clientIds.length ? clientIds : [''])),
  ]);
  const items = new Map<string, any[]>();
  for (const it of (itemRes.results || []) as any[]) {
    if (!items.has(it.quoteId)) items.set(it.quoteId, []);
    items.get(it.quoteId)!.push(fromDbRow('pos_quote_items', it));
  }
  const clients = new Map(((cliRes.results || []) as any[]).map((c) => [c.id, { id: c.id, fullName: c.fullName, docType: c.docType, docNumber: c.docNumber }]));
  return quotes.map((q) => ({
    ...q,
    items: items.get(q.id) || [],
    ...(withClient ? { client: (q.clientId && clients.get(q.clientId)) || null } : {}),
  }));
}

async function loadQuoteSql(D1: D1Database, tenantId: string, id: string) {
  const [q] = await loadQuotesSql(D1, tenantId, 'AND id = ?2', [id], false);
  return q || null;
}

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 1000);

    const conds: string[] = [];
    const params: unknown[] = [];
    if (status) { params.push(status); conds.push(`AND status = ?${params.length + 1}`); }
    if (userId) { params.push(userId); conds.push(`AND userId = ?${params.length + 1}`); }
    const where = conds.join(' ');

    const [quotes, countRow] = await Promise.all([
      loadQuotesSql(D1, tenantId, where, params, true, `LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
      D1.prepare(`SELECT COUNT(*) AS n FROM pos_quotes WHERE tenant_id = ?1 ${where}`).bind(tenantId, ...params).first(),
    ]);
    const total = Number((countRow as any)?.n) || 0;

    return NextResponse.json({
      quotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json({ error: 'Error al obtener presupuestos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items son requeridos' }, { status: 400 });
    }

    // Presupuesto e items en un lote atomico. El numero correlativo lo calcula D1 dentro del
    // lote (como la factura): dos presupuestos simultaneos nunca reciben el mismo.
    const batch = new D1Batch(D1, tenantId);
    const quoteId = batch.insert('pos_quotes', {
      number: sqlExpr('SELECT COALESCE(MAX("number"), 0) + 1 FROM "pos_quotes" WHERE "tenant_id" = ?', tenantId),
      userId: body.userId || '',
      userName: body.userName || '',
      clientName: body.clientName || '',
      clientId: body.clientId || null,
      subtotal: sf(body.subtotal),
      taxAmount: sf(body.taxAmount),
      discount: sf(body.discount),
      total: sf(body.total),
      totalBs: sf(body.totalBs),
      exchangeRate: sf(body.exchangeRate),
      notes: body.notes || '',
      validUntil: body.validUntil || '',
      status: 'pendiente',
    });
    for (const item of body.items) {
      batch.insert('pos_quote_items', {
        quoteId,
        productId: item.productId,
        productName: item.productName || '',
        quantity: sf(item.quantity),
        unitPrice: sf(item.unitPrice),
        total: sf(item.total),
        taxType: item.taxType || 'general',
      });
    }
    await batch.commit();

    return NextResponse.json(await loadQuoteSql(D1, tenantId, quoteId), { status: 201 });
  } catch (error: any) {
    console.error('Error creating quote:', error);
    return NextResponse.json({ error: 'Error al crear presupuesto: ' + (error.message || '') }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;

    if (!body.id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const existing = await loadQuoteSql(D1, tenantId, String(body.id));

    if (!existing) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    // Handle convert_to_sale action
    if (body.action === 'convert_to_sale') {
      if (existing.status !== 'pendiente' && existing.status !== 'aprobada') {
        return NextResponse.json({ error: 'Solo se pueden convertir presupuestos en estado "pendiente" o "aprobada"' }, { status: 400 });
      }

      const batch = new D1Batch(D1, tenantId);
      batch.update('pos_quotes', existing.id, { status: 'convertida' });
      await batch.commit();

      // Return quote data so frontend can create a sale
      return NextResponse.json({
        convertToSale: true,
        quote: existing,
      });
    }

    // Handle status update
    if (body.status) {
      const validStatuses = ['pendiente', 'aprobada', 'convertida', 'vencida'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Estado invalido. Use: ${validStatuses.join(', ')}` }, { status: 400 });
      }

      const batch = new D1Batch(D1, tenantId);
      batch.update('pos_quotes', existing.id, { status: body.status });
      await batch.commit();

      return NextResponse.json(await loadQuoteSql(D1, tenantId, existing.id));
    }

    return NextResponse.json({ error: 'Se requiere "status" o "action" en el body' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating quote:', error);
    return NextResponse.json({ error: 'Error al actualizar presupuesto: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const quote: any = fromDbRow('pos_quotes', await D1.prepare('SELECT * FROM pos_quotes WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, id).first());

    if (!quote) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    if (quote.status !== 'pendiente') {
      return NextResponse.json({ error: 'Solo se pueden eliminar presupuestos en estado "pendiente"' }, { status: 400 });
    }

    // Los items se borran en cascada (ON DELETE CASCADE)
    const batch = new D1Batch(D1, tenantId);
    batch.delete('pos_quotes', id);
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote:', error);
    return NextResponse.json({ error: 'Error al eliminar presupuesto' }, { status: 500 });
  }
}
