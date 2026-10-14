export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { D1Batch, fromDbRow } from '@/lib/d1-batch';
import { d1Of, likeContains, selectRow, selectRows } from '@/lib/d1-read';

// Sin Prisma: SQL directo (ver "Limite de CPU" en CLAUDE.md)

const getClient = (D1: D1Database, tenantId: string, id: string) =>
  selectRow(D1, 'pos_clients', 'SELECT * FROM pos_clients WHERE tenant_id = ?1 AND id = ?2', tenantId, id);

/** Error de clave unica de D1 (documento repetido en el negocio). */
const isUniqueError = (e: any) => /UNIQUE constraint failed/i.test(String(e?.message || e));

// GET - Listar clientes
export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';

    const conds: string[] = [];
    const params: unknown[] = [];
    if (search) {
      params.push(likeContains(search));
      const n = params.length + 1;
      conds.push(`AND (fullName LIKE ?${n} ESCAPE '\\' OR docNumber LIKE ?${n} ESCAPE '\\' OR phone LIKE ?${n} ESCAPE '\\' OR email LIKE ?${n} ESCAPE '\\' OR businessName LIKE ?${n} ESCAPE '\\')`);
    }
    if (type) { params.push(type); conds.push(`AND type = ?${params.length + 1}`); }

    const clients = await selectRows(D1, 'pos_clients',
      `SELECT * FROM pos_clients WHERE tenant_id = ?1 AND isActive = 1 ${conds.join(' ')} ORDER BY isFinalClient DESC, fullName ASC LIMIT 100`,
      tenantId, ...params);
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

// POST - Crear cliente
export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    if (!body.fullName?.trim() || !body.docNumber?.trim()) {
      return NextResponse.json({ error: 'Nombre y documento son requeridos' }, { status: 400 });
    }
    const existing = await D1.prepare('SELECT id FROM pos_clients WHERE tenant_id = ?1 AND docNumber = ?2 AND isActive = 1 LIMIT 1')
      .bind(tenantId, body.docNumber.toUpperCase().trim()).first();
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese documento' }, { status: 400 });
    }
    const batch = new D1Batch(D1, tenantId);
    const clientId = batch.insert('pos_clients', {
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
      notes: body.notes || '',
      tag: body.tag || '',
    });
    await batch.commit();
    return NextResponse.json(await getClient(D1, tenantId, clientId));
  } catch (error: any) {
    if (error.code === 'P2002' || isUniqueError(error)) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese documento' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}

// PUT - Actualizar cliente
export async function PUT(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const body = await req.json() as any;
    if (!body.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (body.docNumber) {
      const existing = await D1.prepare('SELECT id FROM pos_clients WHERE tenant_id = ?1 AND docNumber = ?2 AND id <> ?3 AND isActive = 1 LIMIT 1')
        .bind(tenantId, body.docNumber.toUpperCase().trim(), String(body.id)).first();
      if (existing) return NextResponse.json({ error: 'Ya existe otro cliente con ese documento' }, { status: 400 });
    }
    if (!(await getClient(D1, tenantId, String(body.id)))) {
      return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
    }

    const batch = new D1Batch(D1, tenantId);
    batch.update('pos_clients', String(body.id), {
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
      notes: body.notes,
      tag: body.tag,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });
    await batch.commit();
    return NextResponse.json(await getClient(D1, tenantId, String(body.id)));
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

// DELETE - Desactivar cliente
export async function DELETE(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const client: any = await getClient(D1, tenantId, id);
    if (client?.isFinalClient) {
      return NextResponse.json({ error: 'No se puede eliminar el Cliente Final' }, { status: 400 });
    }
    if (!client) return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
    const batch = new D1Batch(D1, tenantId);
    batch.update('pos_clients', id, { isActive: false });
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}

// PATCH - Crear Cliente Final si no existe
export async function PATCH(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    // SQL directo (se pide al abrir la app; ver "Limite de CPU" en CLAUDE.md). Prisma solo para crearlo.
    let finalClient: any = fromDbRow('pos_clients', await (env as any).DB.prepare(
      'SELECT * FROM pos_clients WHERE tenant_id = ?1 AND isFinalClient = 1 LIMIT 1'
    ).bind(tenantId).first());
    if (!finalClient) {
      const batch = new D1Batch(d1Of(env), tenantId);
      const id = batch.insert('pos_clients', {
        type: 'natural', docType: 'V', docNumber: 'V000000000',
        fullName: 'CLIENTE FINAL', isFinalClient: true,
      });
      await batch.commit();
      finalClient = await getClient(d1Of(env), tenantId, id);
    }
    return NextResponse.json(finalClient);
  } catch (error) {
    return NextResponse.json({ error: 'Error al inicializar cliente final' }, { status: 500 });
  }
}
