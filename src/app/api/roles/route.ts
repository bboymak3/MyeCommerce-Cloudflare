import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Default role configurations
const DEFAULT_ROLES = {
  admin: {
    label: 'Administrador',
    permissions: JSON.stringify({ pos: true, products: true, clients: true, reports: true, devolutions: true, cash_closing: true, config: true, backup: true }),
    color: '#7c3aed',
  },
  vendedor: {
    label: 'Vendedor',
    permissions: JSON.stringify({ pos: true, products: true, clients: true, reports: true, devolutions: false, cash_closing: true, config: false, backup: false }),
    color: '#059669',
  },
  cajero: {
    label: 'Cajero',
    permissions: JSON.stringify({ pos: true, products: false, clients: false, reports: false, devolutions: false, cash_closing: false, config: false, backup: false }),
    color: '#2563eb',
  },
};

// Seed default roles if they don't exist
async function seedDefaultRoles() {
  try {
    for (const [roleName, config] of Object.entries(DEFAULT_ROLES)) {
      const existing = await db.roleConfig.findUnique({ where: { roleName } });
      if (!existing) {
        await db.roleConfig.create({
          data: { roleName, label: config.label, permissions: config.permissions, color: config.color },
        });
        console.log(`[ROLES] Default role "${roleName}" created`);
      }
    }
  } catch (error) {
    console.error('[ROLES] Error seeding roles:', error);
  }
}

export async function GET() {
  try {
    await seedDefaultRoles();
    const roles = await db.roleConfig.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Error al obtener roles' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { roleName, label, permissions, color } = body;

    if (!roleName) {
      return NextResponse.json({ error: 'Nombre de rol requerido' }, { status: 400 });
    }

    const existing = await db.roleConfig.findUnique({ where: { roleName } });
    if (!existing) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }

    const updateData: any = {};
    if (label !== undefined) updateData.label = label;
    if (permissions !== undefined) updateData.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
    if (color !== undefined) updateData.color = color;

    const updated = await db.roleConfig.update({
      where: { roleName },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roleName, label, permissions, color } = body;

    if (!roleName) {
      return NextResponse.json({ error: 'Nombre de rol requerido' }, { status: 400 });
    }

    const existing = await db.roleConfig.findUnique({ where: { roleName } });
    if (existing) {
      return NextResponse.json({ error: 'El rol ya existe' }, { status: 409 });
    }

    const created = await db.roleConfig.create({
      data: {
        roleName,
        label: label || roleName,
        permissions: typeof permissions === 'string' ? permissions : JSON.stringify(permissions || {}),
        color: color || '#6366f1',
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roleName = searchParams.get('roleName');

    if (!roleName) {
      return NextResponse.json({ error: 'Nombre de rol requerido' }, { status: 400 });
    }

    if (roleName === 'admin') {
      return NextResponse.json({ error: 'No se puede eliminar el rol de administrador' }, { status: 403 });
    }

    const existing = await db.roleConfig.findUnique({ where: { roleName } });
    if (!existing) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }

    // Check if any users have this role
    const usersWithRole = await db.user.count({ where: { role: roleName } });
    if (usersWithRole > 0) {
      return NextResponse.json({ error: `No se puede eliminar: ${usersWithRole} usuario(s) tienen este rol` }, { status: 409 });
    }

    await db.roleConfig.delete({ where: { roleName } });
    return NextResponse.json({ message: 'Rol eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 });
  }
}
