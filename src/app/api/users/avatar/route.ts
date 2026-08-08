import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Dedicated endpoint for avatar upload - avoids body size issues with main user update
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, avatar } = body;

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { avatar: avatar || '' },
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      permissions: JSON.parse(user.permissions || '{}'),
      avatar: user.avatar || '',
    });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar foto' }, { status: 500 });
  }
}
