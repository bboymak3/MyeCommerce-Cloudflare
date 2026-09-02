export const runtime = 'edge';
import { NextResponse } from 'next/server';

// On Cloudflare Edge, self-updating is not supported.
// Deploy updates via CI/CD pipeline.
export async function POST() {
  return NextResponse.json({ error: 'Auto-update not available on Cloudflare. Deploy updates via CI/CD.' });
}
