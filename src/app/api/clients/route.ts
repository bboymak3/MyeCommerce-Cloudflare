import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET - Listar clientes
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { docNumber: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { businessName: { contains: search } },
      ];
    }
    if (type) where.type = type;

    const clients = await db.client.findMany({
      where,
      orderBy: [{ isFinalClient: 'desc' }, { fullName: 'asc' }],
      take: 100,
    });
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

// POST - Crear cliente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.fullName?.trim() || !body.docNumber?.trim()) {
      return NextResponse.json({ error: 'Nombre y documento son requeridos' }, { status: 400 });
    }
    const existing = await db.client.findFirst({
      where: { docNumber: body.docNumber.toUpperCase().trim(), isActive: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese documento' }, { status: 400 });
    }
    const client = await db.client.create({
      data: {
        type: body.type || 'natural',
        docType: body.docType || 'V',
        docNumber: body.docNumber.toUpperCase().trim(),
        fullName: body.fullName.trim(),
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        businessName: body.businessName || '',
        phone: body.phone || '',
        email: body.email || '',
        address: body.address || '',
        taxInfo: body.taxInfo || '',
        isFinalClient: body.isFinalClient || false,
        creditLimit: body.creditLimit || 0,
      },
    });
    return NextResponse.json(client);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un cliente con ese documento' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}

// PUT - Actualizar cliente
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (body.docNumber) {
      const existing = await db.client.findFirst({
        where: { docNumber: body.docNumber.toUpperCase().trim(), NOT: { id: body.id }, isActive: true },
      });
      if (existing) return NextResponse.json({ error: 'Ya existe otro cliente con ese documento' }, { status: 400 });
    }

    const client = await db.client.update({
      where: { id: body.id },
      data: {
        type: body.type,
        docType: body.docType,
        docNumber: body.docNumber ? body.docNumber.toUpperCase().trim() : undefined,
        fullName: body.fullName,
        firstName: body.firstName,
        lastName: body.lastName,
        businessName: body.businessName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        taxInfo: body.taxInfo,
        isFinalClient: body.isFinalClient,
        creditLimit: body.creditLimit !== undefined ? parseFloat(body.creditLimit) || 0 : undefined,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

// DELETE - Desactivar cliente
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const client = await db.client.findUnique({ where: { id } });
    if (client?.isFinalClient) {
      return NextResponse.json({ error: 'No se puede eliminar el Cliente Final' }, { status: 400 });
    }
    await db.client.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}

// PATCH - Crear Cliente Final si no existe
export async function PATCH() {
  try {
    let finalClient = await db.client.findFirst({ where: { isFinalClient: true } });
    if (!finalClient) {
      finalClient = await db.client.create({
        data: {
          type: 'natural', docType: 'V', docNumber: 'V000000000',
          fullName: 'CLIENTE FINAL', isFinalClient: true,
        },
      });
    }
    return NextResponse.json(finalClient);
  } catch (error) {
    return NextResponse.json({ error: 'Error al inicializar cliente final' }, { status: 500 });
  }
}
