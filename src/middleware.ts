import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './lib/session';

// Rutas API que NO requieren autenticacion (metodos permitidos sin sesion)
const PUBLIC_ROUTES: Record<string, string[] | '*'> = {
  '/api/auth': '*',
  '/api/product-images': ['GET'],
  '/api/nexus-sso': ['GET'],
};

// Rutas API que requieren rol de administrador
const ADMIN_ROUTES = [
  '/api/users',
  '/api/roles',
  '/api/backup',
  '/api/license',
];

// Cabeceras que solo puede fijar este middleware (nunca el cliente)
const TRUSTED_HEADERS = ['x-user-id', 'x-user-role', 'x-username', 'x-tenant-id'];

const TENANT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  const tokenParam = request.nextUrl.searchParams.get('token');
  if (tokenParam) return tokenParam;
  const cookieToken = request.cookies.get('session_token')?.value;
  if (cookieToken) return cookieToken;
  return null;
}

/**
 * Negocio para peticiones sin sesion (login, catalogo publico, imagenes):
 * ?tenant=<id> o la cookie tenant_id que deja el SSO. Por defecto 'default'.
 */
function publicTenantId(request: NextRequest): string {
  const candidate = request.nextUrl.searchParams.get('tenant') || request.cookies.get('tenant_id')?.value || '';
  return TENANT_ID_RE.test(candidate) ? candidate : 'default';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  for (const h of TRUSTED_HEADERS) requestHeaders.delete(h);

  const token = extractToken(request);
  const session = token ? await verifySessionToken(token) : null;

  const isPublic = Object.entries(PUBLIC_ROUTES).some(([r, methods]) =>
    (pathname === r || pathname.startsWith(r + '/')) &&
    (methods === '*' || methods.includes(request.method))
  );
  if (isPublic) {
    requestHeaders.set('x-tenant-id', session?.tenantId || publicTenantId(request));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!token) {
    return NextResponse.json(
      { error: 'Acceso no autorizado. Inicie sesion.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  if (!session) {
    return NextResponse.json(
      { error: 'Sesion expirada o invalida. Inicie sesion nuevamente.', code: 'SESSION_EXPIRED' },
      { status: 401 }
    );
  }

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

  // Inyectar informacion del usuario + NEGOCIO (solo desde el token firmado)
  requestHeaders.set('x-user-id', session.userId);
  requestHeaders.set('x-user-role', session.role);
  requestHeaders.set('x-username', session.username);
  requestHeaders.set('x-tenant-id', session.tenantId || 'default');

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: '/api/:path*',
};
