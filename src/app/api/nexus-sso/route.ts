// SSO endpoint: acepta un token de acceso de nexus-one y abre una sesion del POS
// en el negocio (tenant) correspondiente.
//
// Flujo: nexus-one /api/sso emite un token de 5 minutos (firmado con NEXUS_SSO_SECRET)
// -> redirige a GET /api/nexus-sso?token=... -> aqui se valida, se crea/actualiza el
// usuario dentro del negocio y se redirige a /#sso=<token de sesion del POS>.
export const runtime = 'edge';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDbFromEnv, DEFAULT_TENANT_ID } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { createSessionToken, verifyNexusSsoToken } from '@/lib/session';
import { getNexusTenant } from '@/lib/nexus-tenant';
import { NextRequest, NextResponse } from 'next/server';

const POS_ROLES = new Set(['admin', 'vendedor', 'cajero']);

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const sso = await verifyNexusSsoToken(token);
    if (!sso) {
      return NextResponse.json({ error: 'Token SSO invalido o expirado. Vuelva a entrar desde Nexus One.' }, { status: 401 });
    }

    const { env } = getRequestContext();
    // Los datos anteriores al modo multi-negocio estan en tenant_id 'default' y
    // pertenecen al negocio LEGACY_TENANT_SLUG (wrangler.toml): se usan tal cual.
    const legacySlug = (env as any).LEGACY_TENANT_SLUG || process.env.LEGACY_TENANT_SLUG;
    const tenantId = legacySlug && sso.tenantSlug === legacySlug ? DEFAULT_TENANT_ID : sso.tenantId;
    const nexus = await getNexusTenant((env as any).DB, tenantId, legacySlug);
    if (nexus && !nexus.active) {
      return NextResponse.json({ error: nexus.reason }, { status: 403 });
    }
    const db = createDbFromEnv(env as any, tenantId);
    const role = sso.role && POS_ROLES.has(sso.role) ? sso.role : 'cajero';

    // nexus-one es la fuente de verdad para los usuarios que entran por SSO:
    // se crean la primera vez y su rol se sincroniza en cada acceso.
    let user = await db.user.findFirst({ where: { username: sso.username } });
    if (!user) {
      user = await db.user.create({
        data: {
          username: sso.username,
          // Clave aleatoria: estos usuarios solo entran por SSO.
          password: await hashPassword(crypto.randomUUID() + crypto.randomUUID()),
          fullName: sso.fullName || sso.username,
          role,
          permissions: role === 'admin' ? '{"all":true}' : '',
        },
      });
    } else if (user.role !== role) {
      user = await db.user.update({ where: { id: user.id }, data: { role } });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Usuario desactivado en el POS. Contacte al administrador.' }, { status: 403 });
    }

    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const sessionToken = await createSessionToken({
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId,
    });

    // El token va en el fragmento (#): no se envia al servidor ni queda en logs.
    const response = NextResponse.redirect(new URL(`/#sso=${encodeURIComponent(sessionToken)}`, req.nextUrl.origin));
    response.cookies.set('session_token', sessionToken, {
      path: '/', maxAge: 86400, httpOnly: true, secure: true, sameSite: 'lax',
    });
    // Cookies informativas (no dan acceso): seleccionan el negocio en el login local.
    response.cookies.set('tenant_id', tenantId, {
      path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: false, secure: true, sameSite: 'lax',
    });
    response.cookies.set('tenant_slug', sso.tenantSlug, {
      path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: false, secure: true, sameSite: 'lax',
    });
    return response;
  } catch (error: any) {
    console.error('[nexus-sso]', error);
    return NextResponse.json({ error: `SSO error: ${error.message}` }, { status: 500 });
  }
}
