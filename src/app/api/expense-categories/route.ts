export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow } from '@/lib/d1-batch';
import { d1Of, selectRow } from '@/lib/d1-read';

// Sin Prisma: SQL directo (ver "Limite de CPU" en CLAUDE.md). La pantalla de gastos crea
// las categorias por defecto todas a la vez: con Prisma esas requests se cortaban.

const getCategory = (D1: D1Database, tenantId: string, id: string) =>
  selectRow(D1, 'pos_expense_categories', 'SELECT * FROM pos_expense_categories WHERE tenant_id = ?1 AND id = ?2', tenantId, id);

// GET — Listar categorías de gastos
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { results } = await D1.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM pos_expenses e WHERE e.categoryId = c.id) AS _n
       FROM pos_expense_categories c WHERE c.tenant_id = ?1 AND c.active = 1 ORDER BY c.name ASC`,
    ).bind(tenantId).all();
    const categories = ((results || []) as any[]).map(({ _n, ...row }) => ({ ...fromDbRow('pos_expense_categories', row), _count: { expenses: Number(_n) || 0 } }));
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener categorías de gastos' }, { status: 500 });
  }
}

// POST — Crear categoría
export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    const { name, description = '', icon = 'receipt', color = '#ef4444' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // Verificar que no exista
    const existing = await D1.prepare('SELECT id FROM pos_expense_categories WHERE tenant_id = ?1 AND name = ?2 LIMIT 1').bind(tenantId, name.trim()).first();
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 });
    }

    const batch = new D1Batch(D1, tenantId);
    const id = batch.insert('pos_expense_categories', { name: name.trim(), description, icon, color, active: true });
    await batch.commit();
    const category = await getCategory(D1, tenantId, id);

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al crear categoría: ' + (error.message || '') }, { status: 500 });
  }
}

// PUT — Actualizar categoría
export async function PUT(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    const { id, name, description, icon, color, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const data: any = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
      }
      // Verificar duplicado
      const existing = await D1.prepare('SELECT id FROM pos_expense_categories WHERE tenant_id = ?1 AND name = ?2 AND id <> ?3 LIMIT 1').bind(tenantId, name.trim(), String(id)).first();
      if (existing) {
        return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (description !== undefined) data.description = description;
    if (icon !== undefined) data.icon = icon;
    if (color !== undefined) data.color = color;
    if (active !== undefined) data.active = active;

    if (!(await getCategory(D1, tenantId, String(id)))) {
      return NextResponse.json({ error: 'Error al actualizar categoría: categoría no encontrada' }, { status: 500 });
    }
    const batch = new D1Batch(D1, tenantId);
    batch.update('pos_expense_categories', String(id), data);
    await batch.commit();
    const category = await getCategory(D1, tenantId, String(id));

    return NextResponse.json(category);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al actualizar categoría: ' + (error.message || '') }, { status: 500 });
  }
}

// DELETE — Desactivar categoría (no eliminar si tiene gastos asociados)
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

    // Verificar si tiene gastos asociados
    const countRow: any = await D1.prepare('SELECT COUNT(*) AS n FROM pos_expenses WHERE tenant_id = ?1 AND categoryId = ?2').bind(tenantId, id).first();
    const batch = new D1Batch(D1, tenantId);
    if (Number(countRow?.n) > 0) {
      // Desactivar en lugar de eliminar
      batch.update('pos_expense_categories', id, { active: false });
      await batch.commit();
      return NextResponse.json({ success: true, message: 'Categoría desactivada (tiene gastos asociados)' });
    }

    batch.delete('pos_expense_categories', id);
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al eliminar categoría: ' + (error.message || '') }, { status: 500 });
  }
}
