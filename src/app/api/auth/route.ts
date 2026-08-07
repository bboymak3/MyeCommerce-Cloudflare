import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, verifyPassword, needsRehash } from '@/lib/auth';

// Rate limiting: max 5 intentos fallidos por IP en 5 minutos
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.lastAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string) {
  const entry = loginAttempts.get(ip);
  if (entry && Date.now() - entry.lastAttempt <= ATTEMPT_WINDOW_MS) {
    entry.count++;
    entry.lastAttempt = Date.now();
  } else {
    loginAttempts.set(ip, { count: 1, lastAttempt: Date.now() });
  }
}

function clearFailedAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// Auto-seed admin user if no admin exists (checks by username, not by user count)
async function ensureAdminUser() {
  try {
    const existing = await db.user.findUnique({ where: { username: 'admin' } });
    if (!existing) {
      await db.user.create({
        data: {
          username: 'admin',
          password: hashPassword('admin'),
          fullName: 'Administrador',
          role: 'admin',
          isActive: true,
          permissions: '{"all":true}',
        },
      });
      console.log('[AUTH] Usuario admin creado automaticamente (admin/admin)');
    }
  } catch (error) {
    console.error('[AUTH] Error al crear usuario admin:', error);
  }
}

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

export async function POST(req: NextRequest) {
  try {
    // Ensure admin exists
    await ensureAdminUser();

    const body = await req.json();
    const { username, password } = body;

    // Rate limiting por IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espere 5 minutos.' }, { status: 429 });
    }

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contrasena son requeridos' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { username },
    });

    if (!user) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Usuario o contrasena incorrectos' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Usuario desactivado. Contacte al administrador.' }, { status: 403 });
    }

    if (!verifyPassword(password, user.password)) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Usuario o contrasena incorrectos' }, { status: 401 });
    }

    // Migracion automatica: si el hash esta en formato viejo, re-hashear con scrypt
    let updatedUser = user;
    if (needsRehash(user.password)) {
      updatedUser = await db.user.update({
        where: { id: user.id },
        data: { password: hashPassword(password) },
      });
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Limpiar intentos fallidos al login exitoso
    clearFailedAttempts(ip);

    const responseData: Record<string, unknown> = { ...serializeUser(updatedUser) };

    // Forzar cambio de contraseña si es la contraseña por defecto (admin/admin)
    const isDefaultPassword = password === 'admin' && user.username === 'admin';
    if (isDefaultPassword) {
      responseData.requirePasswordChange = true;
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, currentPassword, newPassword } = body;

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La nueva contrasena debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // No permitir volver a la contraseña por defecto
    if (user.username === 'admin' && newPassword === 'admin') {
      return NextResponse.json({ error: 'No puede usar la contrasena por defecto. Elija una mas segura.' }, { status: 400 });
    }

    if (!verifyPassword(currentPassword, user.password)) {
      return NextResponse.json({ error: 'Contrasena actual incorrecta' }, { status: 401 });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: { password: hashPassword(newPassword) },
    });

    return NextResponse.json({ message: 'Contrasena actualizada correctamente', user: serializeUser(updated) });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
