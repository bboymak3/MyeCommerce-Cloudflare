/**
 * Edge Runtime context helper.
 * Provides access to D1 database and R2 storage from within request handlers.
 * 
 * Usage in API routes:
 *   import { withDb } from '@/lib/edge-context';
 *   
 *   export async function GET(req: NextRequest) {
 *     return withDb(async (db) => {
 *       const products = await db.product.findMany();
 *       return NextResponse.json(products);
 *     });
 *   }
 */

import { NextResponse } from 'next/server';
import { createDb } from './db';

type DbHandler<T = any> = (db: import('@prisma/client').PrismaClient, req: Request) => Promise<T>;

export async function withDb(handler: DbHandler, req?: Request) {
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const { env } = getRequestContext();
    const db = createDb(env.DB);
    const result = await handler(db, req as Request);
    return result;
  } catch (error: any) {
    console.error('[withDb]', error);
    if (error?.message?.includes('getRequestContext')) {
      // Not in Cloudflare context - use default db
      const { db } = await import('./db');
      return handler(db, req as Request);
    }
    throw error;
  }
}
