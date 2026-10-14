export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { veDayStart, veDayEnd, veNoon, veDateKey } from '@/lib/ve-time';
import { D1Batch, fromDbRow, toDbDate } from '@/lib/d1-batch';
import { d1Of } from '@/lib/d1-read';

// Sin Prisma: SQL directo (ver "Limite de CPU" en CLAUDE.md)

/** Gastos con su categoria y usuario, en el formato que devolvia Prisma con include. */
async function loadExpensesSql(D1: D1Database, tenantId: string, where: string, params: unknown[]) {
  const { results } = await D1.prepare(
    `SELECT e.*, c.id AS _cid, c.name AS _cname, c.icon AS _cicon, c.color AS _ccolor,
       u.id AS _uid, u.fullName AS _ufull, u.username AS _uname, u.role AS _urole
     FROM pos_expenses e
     LEFT JOIN pos_expense_categories c ON c.id = e.categoryId
     LEFT JOIN pos_users u ON u.id = e.userId
     WHERE e.tenant_id = ?1 ${where} ORDER BY e.date DESC`,
  ).bind(tenantId, ...params).all();
  return ((results || []) as any[]).map(({ _cid, _cname, _cicon, _ccolor, _uid, _ufull, _uname, _urole, ...row }) => ({
    ...fromDbRow('pos_expenses', row),
    category: _cid ? { id: _cid, name: _cname, icon: _cicon, color: _ccolor } : null,
    user: _uid ? { id: _uid, fullName: _ufull, username: _uname, role: _urole } : null,
  }));
}

async function loadExpenseSql(D1: D1Database, tenantId: string, id: string) {
  const [e] = await loadExpensesSql(D1, tenantId, 'AND e.id = ?2', [id]);
  return e || null;
}

/**
 * Instante a guardar para la fecha del calendario ('YYYY-MM-DD'): si es hoy en Caracas, ahora
 * (asi entra en el turno de caja abierto); otro dia, su mediodia de Caracas. A medianoche UTC
 * caeria en el dia anterior.
 */
function expenseDate(day: string): Date {
  return day === veDateKey() ? new Date() : veNoon(day);
}

// GET — Listar gastos con filtros
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const categoryId = searchParams.get('categoryId');
    const paymentMethod = searchParams.get('paymentMethod');

    const conds: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); conds.push(sql.replace('?', `?${params.length + 1}`)); };
    if (startDate) add('AND e.date >= ?', toDbDate(veDayStart(startDate)));
    if (endDate) add('AND e.date <= ?', toDbDate(veDayEnd(endDate)));
    if (categoryId) add('AND e.categoryId = ?', categoryId);
    if (paymentMethod) add('AND e.paymentMethod = ?', paymentMethod);

    const expenses = await loadExpensesSql(D1, tenantId, conds.join(' '), params);

    return NextResponse.json(expenses);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

// POST — Crear gasto
export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    const { categoryId, description, amount, date, paymentMethod = 'efectivo', reference = '', notes = '' } = body;
    // Quien registra el gasto sale de la sesion, no del cuerpo
    const userId = req.headers.get('x-user-id') || body.userId || null;

    // Validaciones
    if (!categoryId) {
      return NextResponse.json({ error: 'La categoría es requerida' }, { status: 400 });
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 });
    }
    if (!(parseFloat(amount) > 0)) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }
    if (!date || isNaN(expenseDate(String(date)).getTime())) {
      return NextResponse.json({ error: 'La fecha es requerida' }, { status: 400 });
    }

    // Obtener tasa de cambio
    const [settingsRes, catRes] = await D1.batch([
      D1.prepare('SELECT bcvRate FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId),
      D1.prepare('SELECT id FROM pos_expense_categories WHERE tenant_id = ?1 AND id = ?2 AND active = 1 LIMIT 1').bind(tenantId, String(categoryId)),
    ]);
    const settings: any = (settingsRes.results || [])[0];
    const exchangeRate = parseFloat(body.exchangeRate) || settings?.bcvRate || 36.5;
    const amountNum = parseFloat(amount);
    const amountBs = parseFloat(body.amountBs) || (amountNum * exchangeRate);

    // Verificar que la categoría existe y esté activa
    const category = (catRes.results || [])[0];
    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada o inactiva' }, { status: 400 });
    }

    const batch = new D1Batch(D1, tenantId);
    const expenseId = batch.insert('pos_expenses', {
      categoryId,
      description: description.trim(),
      amount: amountNum,
      amountBs: Math.round(amountBs * 100) / 100,
      exchangeRate,
      date: expenseDate(String(date)),
      paymentMethod,
      reference,
      notes,
      userId,
    });
    await batch.commit();
    const expense = await loadExpenseSql(D1, tenantId, expenseId);

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al registrar gasto: ' + (error.message || '') }, { status: 500 });
  }
}

// PUT — Actualizar gasto
export async function PUT(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    const { id, categoryId, description, amount, date, paymentMethod, reference, notes, exchangeRate } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const existing: any = fromDbRow('pos_expenses', await D1.prepare('SELECT * FROM pos_expenses WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, String(id)).first());
    if (!existing) {
      return NextResponse.json({ error: 'Error al actualizar gasto: gasto no encontrado' }, { status: 500 });
    }

    const data: any = {};
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (description !== undefined) data.description = String(description).trim();
    if (amount !== undefined) {
      const amountNum = parseFloat(amount);
      if (!(amountNum > 0)) {
        return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
      }
      data.amount = amountNum;
    }
    if (date !== undefined) {
      const parsed = expenseDate(String(date));
      if (isNaN(parsed.getTime())) return NextResponse.json({ error: 'Fecha invalida' }, { status: 400 });
      // Solo se mueve si cambio el dia: editar otro dato no debe sacarlo de su turno o cierre
      if (veDateKey(existing.date) !== veDateKey(parsed)) data.date = parsed;
    }
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;
    if (reference !== undefined) data.reference = reference;
    if (notes !== undefined) data.notes = notes;

    if (amount !== undefined || exchangeRate !== undefined) {
      const rate = parseFloat(String(exchangeRate)) || existing.exchangeRate || 36.5;
      const amt = amount !== undefined ? parseFloat(amount) : existing.amount;
      data.amountBs = Math.round(amt * rate * 100) / 100;
      data.exchangeRate = rate;
    }

    const batch = new D1Batch(D1, tenantId);
    batch.update('pos_expenses', String(id), data);
    await batch.commit();
    const expense = await loadExpenseSql(D1, tenantId, String(id));

    return NextResponse.json(expense);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al actualizar gasto: ' + (error.message || '') }, { status: 500 });
  }
}

// DELETE — Eliminar gasto
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

    const batch = new D1Batch(D1, tenantId);
    batch.delete('pos_expenses', id);
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al eliminar gasto: ' + (error.message || '') }, { status: 500 });
  }
}
