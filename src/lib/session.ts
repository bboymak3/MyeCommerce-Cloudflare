// Session utilities - Edge Runtime compatible (jose library)
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = 'myecommerce-pos-jwt-secret-v2.9.34-change-in-production';
const JWT_EXPIRES_IN = '24h';

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

/**
 * Generate a signed JWT session token using jose (Edge compatible).
 * ASYNC because jose is async.
 */
export async function createSessionToken(user: {
  id: string;
  username: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ userId: user.id, username: user.username, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getSecretKey());
}

/**
 * Verify and decode a JWT token using jose (Edge compatible).
 * ASYNC because jose is async.
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
 * Extract JWT token from request (Authorization header, query param, or cookie).
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    return tokenParam;
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/session_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validate a session from a request.
 * ASYNC because verifySessionToken is now async.
 */
export async function validateSession(request: Request): Promise<SessionPayload | null> {
  const token = extractToken(request);
  if (!token) return null;
  return verifySessionToken(token);
}
