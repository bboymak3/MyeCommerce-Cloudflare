import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const categories = await db.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('Categories GET error:', error.message || error);
    return NextResponse.json({ error: 'Error al obtener categorias: ' + (error.message || '') }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Nombre de la categoria es requerido' }, { status: 400 });
    }
    // Case-insensitive: evitar duplicados ignorando mayusculas/minusculas
    // SQLite no soporta ILIKE, usamos findMany + filter en JS
    const allCategories = await db.category.findMany({ select: { id: true, name: true, icon: true, color: true } });
    const existing = allCategories.find((c: any) => c.name.toLowerCase() === body.name.trim().toLowerCase());
    if (existing) {
      await db.category.update({ where: { id: existing.id }, data: { name: body.name.trim(), icon: body.icon || existing.icon, color: body.color || existing.color } });
      const updated = await db.category.findUnique({ where: { id: existing.id }, include: { _count: { select: { products: true } } } });
      return NextResponse.json(updated, { status: 200 });
    }
    const category = await db.category.create({
      data: { name: body.name.trim(), icon: body.icon || '', color: body.color || '#6366f1' },
    });
    const catWithCount = await db.category.findUnique({ where: { id: category.id }, include: { _count: { select: { products: true } } } });
    return NextResponse.json(catWithCount, { status: 201 });
  } catch (error: any) {
    console.error('Categories POST error:', error.message || error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Categoria ya existe' }, { status: 409 });
    }
    const msg = error?.message || '';
    if (msg.includes('no such table') || msg.includes('Unknown table') || msg.includes('does not exist')) {
      return NextResponse.json({ error: 'Tabla de categorias no existe. Ejecute: npm run setup' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Error al crear categoria: ' + msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await db.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Categories DELETE error:', error.message || error);
    return NextResponse.json({ error: 'Error al eliminar categoria' }, { status: 500 });
  }
}
