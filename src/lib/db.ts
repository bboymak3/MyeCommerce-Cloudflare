// Database client - Edge Runtime with D1 via Prisma adapter
// Multi-tenant: tenant_id available via getTenantId() for manual filtering
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

/**
 * Create a PrismaClient backed by Cloudflare D1.
 */
export function createDb(d1: D1Database): PrismaClient {
  const adapter = new PrismaD1(d1);
  return new PrismaClient({ adapter });
}

/**
 * Convenience: create db from full env object.
 * tenantId parameter kept for API compatibility but filtering is done at query level.
 */
export function createDbFromEnv(env: any, _tenantId?: string): PrismaClient {
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
}

/**
 * Get tenant_id from request headers (set by middleware).
 * Returns 'default' for backward compatibility with existing single-tenant data.
 * Use this in your queries: db.product.findMany({ where: { tenant_id: getTenantId(req.headers), ... } })
 */
export function getTenantId(headers: Headers): string {
  return headers.get('x-tenant-id') || 'default';
}

export type { PrismaClient } from '@prisma/client';
