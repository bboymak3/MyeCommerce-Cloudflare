import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const activeOnly = searchParams.get('active') !== 'false';

    const suppliers = await db.supplier.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(search ? { OR: [
          { name: { contains: search } },
          { rif: { contains: search } },
          { phone: { contains: search } },
        ]} : {}),
      },
      include: { _count: { select: { purchases: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(suppliers);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'El nombre del proveedor es requerido' }, { status: 400 });
    }
    const supplier = await db.supplier.create({
      data: {
        name: body.name.trim(),
        rif: body.rif || '',
        phone: body.phone || '',
        email: body.email || '',
        address: body.address || '',
        contact: body.contact || '',
        notes: body.notes || '',
      },
    });
    return NextResponse.json(supplier);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const supplier = await db.supplier.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim(),
        rif: body.rif || undefined,
        phone: body.phone || undefined,
        email: body.email || undefined,
        address: body.address || undefined,
        contact: body.contact || undefined,
        notes: body.notes || undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
      },
    });
    return NextResponse.json(supplier);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await db.supplier.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al desactivar proveedor' }, { status: 500 });
  }
}
