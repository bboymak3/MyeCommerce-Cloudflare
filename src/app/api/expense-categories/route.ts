import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET — Listar categorías de gastos
export async function GET() {
  try {
    const categories = await db.expenseCategory.findMany({
      where: { active: true },
      include: { _count: { select: { expenses: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener categorías de gastos' }, { status: 500 });
  }
}

// POST — Crear categoría
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description = '', icon = 'receipt', color = '#ef4444' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // Verificar que no exista
    const existing = await db.expenseCategory.findFirst({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 });
    }

    const category = await db.expenseCategory.create({
      data: { name: name.trim(), description, icon, color },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al crear categoría: ' + (error.message || '') }, { status: 500 });
  }
}

// PUT — Actualizar categoría
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
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
      const existing = await db.expenseCategory.findFirst({ where: { name: name.trim(), id: { not: id } } });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (description !== undefined) data.description = description;
    if (icon !== undefined) data.icon = icon;
    if (color !== undefined) data.color = color;
    if (active !== undefined) data.active = active;

    const category = await db.expenseCategory.update({
      where: { id },
      data,
    });

    return NextResponse.json(category);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al actualizar categoría: ' + (error.message || '') }, { status: 500 });
  }
}

// DELETE — Desactivar categoría (no eliminar si tiene gastos asociados)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // Verificar si tiene gastos asociados
    const expenseCount = await db.expense.count({ where: { categoryId: id } });
    if (expenseCount > 0) {
      // Desactivar en lugar de eliminar
      await db.expenseCategory.update({ where: { id }, data: { active: false } });
      return NextResponse.json({ success: true, message: 'Categoría desactivada (tiene gastos asociados)' });
    }

    await db.expenseCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al eliminar categoría: ' + (error.message || '') }, { status: 500 });
  }
}
