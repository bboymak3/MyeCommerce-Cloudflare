// Database client - Edge Runtime compatible (D1 via Prisma adapter)
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
 * Create db from full env object.
 */
export function createDbFromEnv(env: { DB: D1Database }): PrismaClient {
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
}

// Default PrismaClient for local dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient();
}

/**
 * Default db export. Works for local development.
 * 
 * IMPORTANT FOR CLOUDFLARE DEPLOYMENT:
 * In Edge Runtime API routes, you MUST override this at the top of each handler:
 * 
 *   import { db as defaultDb, createDbFromEnv } from '@/lib/db';
 *   import { getRequestContext } from '@cloudflare/next-on-pages';
 *   
 *   export async function GET(req: NextRequest) {
 *     const db = createDbFromEnv(getRequestContext().env);
 *     // ... use db normally
 *   }
 * 
 * Alternatively, for quick migration, add this to the top of each handler:
 *   let db = defaultDb;
 *   try { db = createDbFromEnv(getRequestContext().env); } catch {}
 */
export const db = globalForPrisma.prisma;
