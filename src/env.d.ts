import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

declare module '@cloudflare/next-on-pages' {
  interface Env {
    DB: D1Database;
    R2_PHOTOS: R2Bucket;
    NODE_ENV: string;
    // Secretos (npx wrangler pages secret put ...), nunca en wrangler.toml
    JWT_SECRET: string;
    NEXUS_SSO_SECRET: string;
    LEGACY_TENANT_SLUG?: string;
  }
}

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    R2_PHOTOS: R2Bucket;
    NODE_ENV: string;
    JWT_SECRET: string;
    NEXUS_SSO_SECRET: string;
    LEGACY_TENANT_SLUG?: string;
  }
}
