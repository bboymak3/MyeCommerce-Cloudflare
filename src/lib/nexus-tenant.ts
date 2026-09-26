// Estado del negocio segun Nexus One (misma D1: tablas nx_*).
// La licencia de los negocios creados en Nexus One la controla el super admin:
// activo/suspendido + fecha de corte (mensual o anual). No se usan claves.
import { DEFAULT_TENANT_ID } from './db';

export interface NexusTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  billingCycle: string;
  expiresAt: string | null;
  active: boolean;
  reason: string;
}

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: NexusTenant | null }>();

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
}

/**
 * Devuelve el negocio de Nexus One al que pertenece `tenantId`, o null si no hay
 * uno (instalacion independiente: se sigue usando la licencia por clave).
 * 'default' corresponde al negocio LEGACY_TENANT_SLUG (datos anteriores).
 */
export async function getNexusTenant(
  d1: D1Database | undefined,
  tenantId: string,
  legacySlug?: string
): Promise<NexusTenant | null> {
  if (!d1) return null;
  const key = `${tenantId}|${legacySlug || ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let row: any = null;
  try {
    const sql = 'SELECT id, name, slug, status, plan, billing_cycle, subscription_expires_at FROM nx_tenants WHERE ';
    row = tenantId === DEFAULT_TENANT_ID
      ? (legacySlug ? await d1.prepare(sql + 'slug = ?').bind(legacySlug).first() : null)
      : await d1.prepare(sql + 'id = ?').bind(tenantId).first();
  } catch {
    row = null; // sin tablas nx_ (instalacion independiente)
  }

  let value: NexusTenant | null = null;
  if (row) {
    const expiresAt: string | null = row.subscription_expires_at || null;
    const expired = !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
    let reason = '';
    if (row.status !== 'active') reason = 'Este negocio esta suspendido. Contacte al administrador de Nexus One.';
    else if (expired) reason = `La suscripcion de este negocio vencio el ${formatDate(expiresAt!)}. Contacte al administrador de Nexus One para renovarla.`;
    value = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      plan: row.plan,
      billingCycle: row.billing_cycle || 'monthly',
      expiresAt,
      active: !reason,
      reason,
    };
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Plan de Nexus One -> tipo de licencia del POS. */
export function planToLicenseType(plan: string): 'basica' | 'profesional' {
  return plan === 'business' || plan === 'premium' ? 'profesional' : 'basica';
}

/**
 * Resuelve el codigo (slug) de un negocio de Nexus One a su tenant_id en el POS.
 * El negocio LEGACY_TENANT_SLUG usa 'default' (datos anteriores). null si no existe.
 */
export async function tenantIdFromSlug(
  d1: D1Database | undefined,
  slug: string,
  legacySlug?: string
): Promise<string | null> {
  if (!d1 || !slug) return null;
  if (legacySlug && slug === legacySlug) return DEFAULT_TENANT_ID;
  try {
    const row: any = await d1.prepare('SELECT id FROM nx_tenants WHERE slug = ?').bind(slug).first();
    return row?.id || null;
  } catch {
    return null;
  }
}

let nexusDeployment: boolean | null = null;
/** true si esta D1 es compartida con Nexus One (existe la tabla nx_tenants). */
export async function isNexusDeployment(d1: D1Database | undefined): Promise<boolean> {
  if (!d1) return false;
  if (nexusDeployment !== null) return nexusDeployment;
  try {
    await d1.prepare('SELECT 1 FROM nx_tenants LIMIT 1').first();
    nexusDeployment = true;
  } catch {
    nexusDeployment = false;
  }
  return nexusDeployment;
}
