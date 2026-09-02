import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Rutas API que NO requieren autenticacion
const PUBLIC_ROUTES = [
  '/api/auth',
  '/api/product-images',
  '/api/catalog',
];

// Rutas API que requieren rol de administrador
const ADMIN_ROUTES = [
  '/api/users',
  '/api/roles',
  '/api/backup',
  '/api/license',
];

// JWT Secret — debe coincidir con src/lib/session.ts
const JWT_SECRET = 'myecommerce-pos-jwt-secret-v2.9.34-change-in-production';

async function verifyToken(token: string): Promise<{ userId: string; username: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET), {
      algorithms: ['HS256'],
    });
    return {
      userId: (payload as any).userId,
      username: (payload as any).username,
      role: (payload as any).role,
    };
  } catch {
    return null;
  }
}

function extractToken(request: NextRequest): string | null {
  // Header Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Query param ?token=<token>
  const tokenParam = request.nextUrl.searchParams.get('token');
  if (tokenParam) {
    return tokenParam;
  }

  // Cookie: session_token=<token>
  const cookieToken = request.cookies.get('session_token')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo verificar rutas bajo /api/
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Permitir rutas publicas sin autenticacion
  for (const publicRoute of PUBLIC_ROUTES) {
    if (pathname === publicRoute || pathname.startsWith(publicRoute + '/')) {
      return NextResponse.next();
    }
  }

  // Extraer y verificar token
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json(
      { error: 'Acceso no autorizado. Inicie sesion.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const session = await verifyToken(token);
  if (!session) {
    return NextResponse.json(
      { error: 'Sesion expirada o invalida. Inicie sesion nuevamente.', code: 'SESSION_EXPIRED' },
      { status: 401 }
    );
  }

  // Verificar rutas de administrador
  for (const adminRoute of ADMIN_ROUTES) {
    if (pathname === adminRoute || pathname.startsWith(adminRoute + '/')) {
      if (session.role !== 'admin') {
        return NextResponse.json(
          { error: 'Acceso restringido. Se requiere rol de administrador.', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }
  }

  // Inyectar informacion del usuario en headers para que las rutas API la puedan usar
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.userId);
  requestHeaders.set('x-user-role', session.role);
  requestHeaders.set('x-username', session.username);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Configurar matcher para que solo se ejecute en rutas API
export const config = {
  matcher: '/api/:path*',
};
