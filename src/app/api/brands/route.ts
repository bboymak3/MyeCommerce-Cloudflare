import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const brands = await db.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(brands);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener marcas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Nombre de la marca es requerido' }, { status: 400 });
    }
    // Case-insensitive check: buscar si ya existe una marca con el mismo nombre (ignorando mayusculas/minusculas)
    // SQLite no soporta ILIKE, usamos findMany + filter en JS
    const allBrands = await db.brand.findMany({ select: { id: true, name: true } });
    const existing = allBrands.find((b: any) => b.name.toLowerCase() === body.name.trim().toLowerCase());
    if (existing) {
      // Si existe pero con diferente casing, actualizar al casing nuevo
      await db.brand.update({ where: { id: existing.id }, data: { name: body.name.trim() } });
      return NextResponse.json({ ...existing, name: body.name.trim() }, 200);
    }
    const brand = await db.brand.create({
      data: { name: body.name.trim() },
    });
    return NextResponse.json(brand, 201);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Marca ya existe' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear marca' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await db.brand.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar marca' }, { status: 500 });
  }
}
