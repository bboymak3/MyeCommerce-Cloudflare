// Database client - Edge Runtime with D1 via Prisma adapter
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

/**
 * Create a PrismaClient backed by Cloudflare D1.
 * Must be called from within a request handler that has access to getRequestContext().
 */
export function createDb(d1: D1Database): PrismaClient {
  const adapter = new PrismaD1(d1);
  return new PrismaClient({ adapter });
}

/**
 * Convenience: create db from full env object.
 */
export function createDbFromEnv(env: any): PrismaClient {
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
}

// Re-export Prisma types for convenience
export type { PrismaClient } from '@prisma/client';
