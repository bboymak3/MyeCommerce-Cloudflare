export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow } from '@/lib/d1-batch';
import { d1Of } from '@/lib/d1-read';

// Sin Prisma: SQL directo (ver "Limite de CPU" en CLAUDE.md)

/** Items de combo con el producto incluido, como el include de Prisma. */
async function comboItemsSql(D1: D1Database, tenantId: string, where: string, ...params: unknown[]) {
  const { results } = await D1.prepare(
    `SELECT ci.*, p.id AS _pid, p.name AS _pname, p.barcode AS _pbarcode, p.price AS _pprice, p.stock AS _pstock, p.icon AS _picon
     FROM pos_combo_items ci LEFT JOIN pos_products p ON p.id = ci.productId
     WHERE ci.tenant_id = ?1 ${where} ORDER BY ci.id ASC`,
  ).bind(tenantId, ...params).all();
  return ((results || []) as any[]).map(({ _pid, _pname, _pbarcode, _pprice, _pstock, _picon, ...r }) => ({
    ...fromDbRow('pos_combo_items', r),
    product: _pid ? { id: _pid, name: _pname, barcode: _pbarcode, price: _pprice, stock: _pstock, icon: _picon } : null,
  }));
}

// GET /api/products/combo-items?comboId=xxx
// Obtener todos los items de un combo
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const { searchParams } = new URL(req.url);
    const comboId = searchParams.get('comboId');
    if (!comboId) {
      return NextResponse.json({ error: 'comboId requerido' }, { status: 400 });
    }
    const items = await comboItemsSql(d1Of(env), tenantId, 'AND ci.comboId = ?2', comboId);
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener items del combo' }, { status: 500 });
  }
}

// POST /api/products/combo-items
// Agregar un producto a un combo
export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    const { comboId, productId, quantity } = body;
    if (!comboId || !productId) {
      return NextResponse.json({ error: 'comboId y productId son requeridos' }, { status: 400 });
    }
    if (comboId === productId) {
      return NextResponse.json({ error: 'Un combo no puede contenerse a si mismo' }, { status: 400 });
    }
    const qty = Math.max(1, parseInt(quantity || 1));
    const batch = new D1Batch(D1, tenantId);
    // Verificar que no exista ya: si existe, se actualiza la cantidad
    const existing: any = await D1.prepare('SELECT id FROM pos_combo_items WHERE tenant_id = ?1 AND comboId = ?2 AND productId = ?3 LIMIT 1')
      .bind(tenantId, comboId, productId).first();
    let id: string;
    if (existing) {
      id = existing.id;
      batch.update('pos_combo_items', id, { quantity: qty });
    } else {
      id = batch.insert('pos_combo_items', { comboId, productId, quantity: qty });
    }
    await batch.commit();
    const [item] = await comboItemsSql(D1, tenantId, 'AND ci.id = ?2', id);
    return NextResponse.json(item || null);
  } catch (error) {
    return NextResponse.json({ error: 'Error al agregar item al combo' }, { status: 500 });
  }
}

// DELETE /api/products/combo-items?id=xxx
// Eliminar un item de un combo
export async function DELETE(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const existing = await D1.prepare('SELECT id FROM pos_combo_items WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, id).first();
    if (!existing) return NextResponse.json({ error: 'Error al eliminar item del combo' }, { status: 500 });
    const batch = new D1Batch(D1, tenantId);
    batch.delete('pos_combo_items', id);
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar item del combo' }, { status: 500 });
  }
}
