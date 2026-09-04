// SSO endpoint: Accepts Nexus One JWT token and creates a myecommerce session
// This allows tenants from nexus-one to seamlessly access their POS
export const runtime = 'edge';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDbFromEnv } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const NEXUS_JWT_SECRET = new TextEncoder().encode('nexus-one-super-secret-change-in-production-2024');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const slug = searchParams.get('slug');

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    // Verify the nexus-one JWT
    const { payload } = await jwtVerify(token, NEXUS_JWT_SECRET);

    if (payload.userType !== 'tenant' || !payload.tenantId) {
      return NextResponse.json({ error: 'Token no es de tenant' }, { status: 400 });
    }

    // Use the tenant_id from the token to identify the tenant in our D1
    const tenantId = payload.tenantId as string;
    const tenantSlug = payload.tenantSlug as string;

    // Build the redirect URL with session cookies
    const baseUrl = new URL(req.url).origin;
    
    // Create a myecommerce session for this tenant
    // Find the user in our users table with this tenant_id
    const { env } = getRequestContext();
    const db = createDbFromEnv(env as any);

    const nexusUsername = payload.username as string;
    
    // Try to find existing user for this tenant
    let user = await db.user.findFirst({
      where: { username: nexusUsername, tenant_id: tenantId }
    });

    if (!user) {
      // Auto-create the user for this tenant if they don't exist
      user = await db.user.create({
        data: {
          username: nexusUsername,
          password: 'nexus-sso-managed',
          fullName: (payload as any).fullName || nexusUsername,
          role: (payload as any).role || 'admin',
          tenant_id: tenantId,
        }
      });
    }

    // Create a myecommerce POS token (using our own JWT)
    const myecommerceToken = await createMyecommerceToken(user, tenantId);

    // Redirect to the POS app with the session set
    const redirectUrl = new URL(baseUrl);
    redirectUrl.searchParams.set('nexus_token', myecommerceToken);
    redirectUrl.searchParams.set('tenant_id', tenantId);
    redirectUrl.searchParams.set('tenant_slug', tenantSlug);
    
    // Set cookies and redirect to main page
    const response = NextResponse.redirect(new URL('/?sso=1', baseUrl));
    response.cookies.set('session_token', myecommerceToken, { 
      path: '/', maxAge: 86400, httpOnly: false, sameSite: 'lax' 
    });
    response.cookies.set('tenant_id', tenantId, { 
      path: '/', maxAge: 86400, httpOnly: false, sameSite: 'lax' 
    });
    response.cookies.set('tenant_slug', tenantSlug, { 
      path: '/', maxAge: 86400, httpOnly: false, sameSite: 'lax' 
    });
    
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: `SSO error: ${error.message}` }, { status: 400 });
  }
}

async function createMyecommerceToken(user: any, tenantId: string): Promise<string> {
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'myecommerce-pos-jwt-secret-v2.9.34-change-in-production'
  );
  return new SignJWT({
    userId: user.id,
    username: user.username,
    role: user.role,
    tenantId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}
