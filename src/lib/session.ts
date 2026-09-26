// Session utilities - Edge Runtime compatible (jose library)
import { SignJWT, jwtVerify } from 'jose';
import { getRequestContext } from '@cloudflare/next-on-pages';

const JWT_EXPIRES_IN = '24h';
// Solo para desarrollo local (next dev); en produccion JWT_SECRET es obligatorio.
const DEV_ONLY_SECRET = 'myecommerce-dev-only-secret';

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
  iat: number;
  exp: number;
}

export interface NexusSsoPayload {
  userId: string;
  username: string;
  fullName?: string;
  role?: string;
  tenantId: string;
  tenantSlug: string;
}

/**
 * Lee una variable de entorno/secreto de Cloudflare (bindings) o de process.env.
 */
function readEnv(name: string): string | undefined {
  try {
    const value = (getRequestContext().env as any)?.[name];
    if (typeof value === 'string' && value) return value;
  } catch {}
  const value = process.env[name];
  return value || undefined;
}

function getSecretKey(): Uint8Array {
  const secret = readEnv('JWT_SECRET');
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV !== 'production') return new TextEncoder().encode(DEV_ONLY_SECRET);
  throw new Error('JWT_SECRET no configurado. Ejecute: npx wrangler pages secret put JWT_SECRET');
}

/**
 * Generate a signed JWT session token using jose (Edge compatible).
 * Incluye tenantId: el negocio al que pertenece el usuario.
 */
export async function createSessionToken(user: {
  id: string;
  username: string;
  role: string;
  tenantId?: string;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    userId: user.id,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId || 'default',
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getSecretKey());
}

/**
 * Verify and decode a JWT token using jose (Edge compatible).
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Verifica un token de acceso emitido por nexus-one (/api/sso).
 * Usa un secreto compartido propio (NEXUS_SSO_SECRET), distinto del de sesion,
 * y solo acepta tokens de corta duracion destinados a este POS.
 */
export async function verifyNexusSsoToken(token: string): Promise<NexusSsoPayload | null> {
  const secret = readEnv('NEXUS_SSO_SECRET');
  if (!secret) throw new Error('NEXUS_SSO_SECRET no configurado. Ejecute: npx wrangler pages secret put NEXUS_SSO_SECRET');
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer: 'nexus-one',
      audience: 'myecommerce-pos',
      maxTokenAge: '5m',
    });
    const p = payload as any;
    if (p.purpose !== 'pos_sso' || !p.tenantId || !p.userId || !p.username) return null;
    return {
      userId: p.userId,
      username: p.username,
      fullName: p.fullName,
      role: p.role,
      tenantId: p.tenantId,
      tenantSlug: p.tenantSlug || '',
    };
  } catch {
    return null;
  }
}

/**
 * Extract JWT token from request (Authorization header, query param, or cookie).
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) return tokenParam;
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Validate a session from a request.
 */
export async function validateSession(request: Request): Promise<SessionPayload | null> {
  const token = extractToken(request);
  if (!token) return null;
  return verifySessionToken(token);
}
