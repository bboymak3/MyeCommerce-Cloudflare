// Database client - Edge Runtime with D1 via Prisma adapter
// Multi-tenant: todas las consultas quedan aisladas por tenant_id automaticamente
// (ver scopeToTenant). Las rutas no deben filtrar tenant_id a mano.
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

export const DEFAULT_TENANT_ID = 'default';

/**
 * Create a PrismaClient backed by Cloudflare D1 (sin aislamiento por negocio).
 * Solo para tareas administrativas; las rutas deben usar createDbFromEnv.
 */
export function createDb(d1: D1Database): PrismaClient {
  const adapter = new PrismaD1(d1);
  return new PrismaClient({ adapter });
}

// Operaciones cuyo `where` se restringe al negocio
const WHERE_OPS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
]);

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Asigna tenant_id a un payload de creacion y a todas las creaciones anidadas
 * (items de venta, items de compra, etc.) para que nunca queden en otro negocio.
 */
function stampCreate(data: any, tenantId: string) {
  if (!isPlainObject(data)) return;
  data.tenant_id = tenantId;
  stampNested(data, tenantId);
}

function stampNested(data: any, tenantId: string) {
  if (!isPlainObject(data)) return;
  for (const value of Object.values(data)) {
    if (!isPlainObject(value)) continue;
    for (const c of toArray(value.create)) stampCreate(c, tenantId);
    if (isPlainObject(value.createMany)) {
      for (const c of toArray(value.createMany.data)) if (isPlainObject(c)) c.tenant_id = tenantId;
    }
    for (const c of toArray(value.connectOrCreate)) if (isPlainObject(c)) stampCreate(c.create, tenantId);
    for (const u of toArray(value.upsert)) {
      if (!isPlainObject(u)) continue;
      stampCreate(u.create, tenantId);
      stampNested(u.update, tenantId);
    }
    for (const u of toArray(value.update)) {
      if (isPlainObject(u)) stampNested(isPlainObject(u.data) ? u.data : u, tenantId);
    }
  }
}

/**
 * Devuelve un cliente Prisma donde toda lectura/escritura esta limitada a un negocio.
 */
export function scopeToTenant(base: PrismaClient, tenantId: string) {
  return base.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          const a: any = args ?? {};
          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where || {}), tenant_id: tenantId };
          }
          switch (operation) {
            case 'create':
              stampCreate(a.data, tenantId);
              break;
            case 'createMany':
            case 'createManyAndReturn':
              for (const d of toArray(a.data)) if (isPlainObject(d)) (d as any).tenant_id = tenantId;
              break;
            case 'update':
            case 'updateMany':
              if (isPlainObject(a.data)) {
                delete a.data.tenant_id; // un registro nunca cambia de negocio
                stampNested(a.data, tenantId);
              }
              break;
            case 'upsert':
              stampCreate(a.create, tenantId);
              if (isPlainObject(a.update)) {
                delete a.update.tenant_id;
                stampNested(a.update, tenantId);
              }
              break;
          }
          return query(a);
        },
      },
    },
  }) as unknown as PrismaClient;
}

/**
 * Cliente de base de datos aislado al negocio indicado.
 */
export function createDbFromEnv(env: any, tenantId: string = DEFAULT_TENANT_ID): PrismaClient {
  return scopeToTenant(createDb(env.DB), tenantId || DEFAULT_TENANT_ID);
}

/**
 * Get tenant_id from request headers (set by middleware, nunca por el cliente).
 * Returns 'default' for backward compatibility with existing single-tenant data.
 */
export function getTenantId(headers: Headers): string {
  return headers.get('x-tenant-id') || DEFAULT_TENANT_ID;
}

export type { PrismaClient } from '@prisma/client';
