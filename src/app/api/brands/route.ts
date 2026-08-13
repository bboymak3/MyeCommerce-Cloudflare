import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const brands = await db.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(brands);
  } catch (error: any) {
    console.error('Brands GET error:', error.message || error);
    return NextResponse.json({ error: 'Error al obtener marcas: ' + (error.message || 'Tabla no encontrada. Ejecute: npm run setup') }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Nombre de la marca es requerido' }, { status: 400 });
    }
    // Case-insensitive check: SQLite no soporta ILIKE, usamos findMany + filter en JS
    const allBrands = await db.brand.findMany({ select: { id: true, name: true } });
    const existing = allBrands.find((b: any) => b.name.toLowerCase() === body.name.trim().toLowerCase());
    if (existing) {
      // Si existe pero con diferente casing, actualizar al casing nuevo
      await db.brand.update({ where: { id: existing.id }, data: { name: body.name.trim() } });
      const updated = await db.brand.findUnique({ where: { id: existing.id }, include: { _count: { select: { products: true } } } });
      return NextResponse.json(updated, { status: 200 });
    }
    const brand = await db.brand.create({
      data: { name: body.name.trim() },
    });
    // Retornar con _count para consistencia con GET
    const brandWithCount = await db.brand.findUnique({ where: { id: brand.id }, include: { _count: { select: { products: true } } } });
    return NextResponse.json(brandWithCount, { status: 201 });
  } catch (error: any) {
    console.error('Brands POST error:', error.message || error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Marca ya existe' }, { status: 409 });
    }
    const msg = error?.message || '';
    if (msg.includes('no such table') || msg.includes('Unknown table') || msg.includes('does not exist')) {
      return NextResponse.json({ error: 'Tabla de marcas no existe. Ejecute: npm run setup' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Error al crear marca: ' + msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await db.brand.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Brands DELETE error:', error.message || error);
    return NextResponse.json({ error: 'Error al eliminar marca' }, { status: 500 });
  }
}
