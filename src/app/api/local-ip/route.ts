import { NextResponse } from 'next/server';

export const runtime = 'edge';

// In Cloudflare, there's no local network interface.
// Return the Cloudflare Workers URL instead.
export async function GET() {
  return NextResponse.json({
    url: 'https://myecommerce-pos.sismtema.workers.dev',
    secureUrl: 'https://myecommerce-pos.sismtema.workers.dev',
    domainUrl: 'https://myecommerce-pos.sismtema.workers.dev',
    ip: 'cloudflare',
    port: 443,
    caddyPort: 443,
    hostname: 'cloudflare-workers',
    domain: 'sismtema.workers.dev',
  });
}
