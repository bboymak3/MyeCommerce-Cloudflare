import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET — Listar gastos con filtros
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const categoryId = searchParams.get('categoryId');
    const paymentMethod = searchParams.get('paymentMethod');

    const where: any = {};

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999'),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    } else if (endDate) {
      where.date = { lte: new Date(endDate + 'T23:59:59.999') };
    }

    if (categoryId) where.categoryId = categoryId;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const expenses = await db.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, fullName: true, username: true, role: true } },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

// POST — Crear gasto
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { categoryId, description, amount, date, paymentMethod = 'efectivo', reference = '', notes = '', userId } = body;

    // Validaciones
    if (!categoryId) {
      return NextResponse.json({ error: 'La categoría es requerida' }, { status: 400 });
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: 'La fecha es requerida' }, { status: 400 });
    }

    // Obtener tasa de cambio
    const settings = await db.settings.findFirst();
    const exchangeRate = parseFloat(body.exchangeRate) || settings?.bcvRate || 36.5;
    const amountNum = parseFloat(amount);
    const amountBs = parseFloat(body.amountBs) || (amountNum * exchangeRate);

    // Verificar que la categoría existe y esté activa
    const category = await db.expenseCategory.findFirst({ where: { id: categoryId, active: true } });
    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada o inactiva' }, { status: 400 });
    }

    const expense = await db.expense.create({
      data: {
        categoryId,
        description: description.trim(),
        amount: amountNum,
        amountBs: Math.round(amountBs * 100) / 100,
        exchangeRate,
        date: new Date(date),
        paymentMethod,
        reference,
        notes,
        userId: userId || null,
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, fullName: true, username: true, role: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al registrar gasto: ' + (error.message || '') }, { status: 500 });
  }
}

// PUT — Actualizar gasto
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, categoryId, description, amount, date, paymentMethod, reference, notes, exchangeRate } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const data: any = {};
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (description !== undefined) data.description = description.trim();
    if (amount !== undefined) {
      const amountNum = parseFloat(amount);
      if (amountNum <= 0) {
        return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
      }
      data.amount = amountNum;
    }
    if (date !== undefined) data.date = new Date(date);
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;
    if (reference !== undefined) data.reference = reference;
    if (notes !== undefined) data.notes = notes;

    if (amount !== undefined || exchangeRate !== undefined) {
      const existing = await db.expense.findFirst({ where: { id } });
      const rate = parseFloat(String(exchangeRate)) || existing?.exchangeRate || 36.5;
      const amt = amount !== undefined ? parseFloat(amount) : existing!.amount;
      data.amountBs = Math.round(amt * rate * 100) / 100;
      data.exchangeRate = rate;
    }

    const expense = await db.expense.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, fullName: true, username: true, role: true } },
      },
    });

    return NextResponse.json(expense);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al actualizar gasto: ' + (error.message || '') }, { status: 500 });
  }
}

// DELETE — Eliminar gasto
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    await db.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al eliminar gasto: ' + (error.message || '') }, { status: 500 });
  }
}
