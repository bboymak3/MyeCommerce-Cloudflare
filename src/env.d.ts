import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

declare module '@cloudflare/next-on-pages' {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    NODE_ENV: string;
    JWT_SECRET: string;
  }
}
