// GET /api/permissions — rol y permisos vigentes del usuario de la sesion.
// La pantalla lo consulta al cargar para mostrar solo los modulos permitidos; el
// middleware aplica las mismas reglas en la API.
export const runtime = 'edge';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/db';
import { getNexusTenant } from '@/lib/nexus-tenant';
import { CAJERO_PERMISSIONS, cajeroPermissions, effectivePermissions, normalizeRole } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const env = getRequestContext().env as any;
  const role = normalizeRole(req.headers.get('x-user-role'));
  const nexus = await getNexusTenant(env.DB, getTenantId(req.headers), env.LEGACY_TENANT_SLUG);
  return NextResponse.json({
    role,
    permissions: effectivePermissions(role, nexus?.cajeroPermissions),
    cajero: cajeroPermissions(nexus?.cajeroPermissions),
    catalog: CAJERO_PERMISSIONS.map(({ key, label }) => ({ key, label })),
    managedBy: nexus ? 'nexus' : 'local',
  });
}
