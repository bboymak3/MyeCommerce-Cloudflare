import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/products/combo-items?comboId=xxx
// Obtener todos los items de un combo
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const comboId = searchParams.get('comboId');
    if (!comboId) {
      return NextResponse.json({ error: 'comboId requerido' }, { status: 400 });
    }
    const items = await db.comboItem.findMany({
      where: { comboId },
      include: {
        product: { select: { id: true, name: true, barcode: true, price: true, stock: true, icon: true } },
      },
      orderBy: { id: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener items del combo' }, { status: 500 });
  }
}

// POST /api/products/combo-items
// Agregar un producto a un combo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { comboId, productId, quantity } = body;
    if (!comboId || !productId) {
      return NextResponse.json({ error: 'comboId y productId son requeridos' }, { status: 400 });
    }
    if (comboId === productId) {
      return NextResponse.json({ error: 'Un combo no puede contenerse a si mismo' }, { status: 400 });
    }
    // Verificar que no exista ya
    const existing = await db.comboItem.findFirst({ where: { comboId, productId } });
    if (existing) {
      // Actualizar cantidad
      const updated = await db.comboItem.update({
        where: { id: existing.id },
        data: { quantity: Math.max(1, parseInt(quantity || 1)) },
        include: { product: { select: { id: true, name: true, barcode: true, price: true, stock: true, icon: true } } },
      });
      return NextResponse.json(updated);
    }
    const item = await db.comboItem.create({
      data: {
        comboId,
        productId,
        quantity: Math.max(1, parseInt(quantity || 1)),
      },
      include: { product: { select: { id: true, name: true, barcode: true, price: true, stock: true, icon: true } } },
    });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Error al agregar item al combo' }, { status: 500 });
  }
}

// DELETE /api/products/combo-items?id=xxx
// Eliminar un item de un combo
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await db.comboItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar item del combo' }, { status: 500 });
  }
}
