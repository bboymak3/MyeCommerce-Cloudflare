import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';

// Helper to serialize user without password
function serializeUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    permissions: JSON.parse(user.permissions || '{}'),
    avatar: user.avatar || '',
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// GET: List all users (without passwords)
export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(users.map(serializeUser));
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

// POST: Create new user (cajero or admin)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, fullName, permissions, role } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contrasena son requeridos' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'El usuario debe tener al menos 3 caracteres' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // Check if username already exists
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 });
    }

    // Determine role and permissions
    const userRole = role || 'cajero';
    let permissionsStr: string;

    if (userRole === 'admin') {
      permissionsStr = JSON.stringify({ all: true });
    } else {
      permissionsStr = JSON.stringify(permissions || { pos: true });
    }

    const user = await db.user.create({
      data: {
        username,
        password: hashPassword(password),
        fullName: fullName || '',
        role: userRole,
        isActive: true,
        permissions: permissionsStr,
        avatar: '',
      },
    });

    return NextResponse.json(serializeUser(user), { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Error al crear usuario' }, { status: 500 });
  }
}

// PUT: Update user (permissions, active status, fullName, role, password)
// NOTE: Avatar is handled by /api/users/avatar endpoint to avoid body size issues
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, fullName, permissions, isActive, role, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Don't allow deactivating admin
    if (existing.role === 'admin' && isActive === false) {
      return NextResponse.json({ error: 'No se puede desactivar al administrador' }, { status: 400 });
    }

    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role !== undefined) {
      if (!['admin', 'cajero', 'vendedor'].includes(role)) {
        return NextResponse.json({ error: 'Rol no valido. Use admin, cajero o vendedor' }, { status: 400 });
      }
      updateData.role = role;
      // When changing to admin, set all permissions
      if (role === 'admin') {
        updateData.permissions = JSON.stringify({ all: true });
      }
    }
    if (password !== undefined) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
      }
      updateData.password = hashPassword(password);
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(serializeUser(user));
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar usuario' }, { status: 500 });
  }
}

// DELETE: Deactivate user (soft delete) or hard delete cajero
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (existing.role === 'admin') {
      return NextResponse.json({ error: 'No se puede eliminar al administrador' }, { status: 400 });
    }

    if (hardDelete) {
      // Hard delete: completely remove from database
      await db.user.delete({
        where: { id },
      });
      return NextResponse.json({ message: 'Cajero eliminado permanentemente' });
    } else {
      // Soft delete: just deactivate
      const user = await db.user.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: 'Usuario desactivado correctamente', user: serializeUser(user) });
    }
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar usuario' }, { status: 500 });
  }
}
