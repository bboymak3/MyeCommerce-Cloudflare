export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';

// On Cloudflare Edge, file-based version downloads are not supported.
// This endpoint is kept as a stub for compatibility.
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    error: 'Version downloads not available on Cloudflare Edge.',
    hint: 'Download updates directly from GitHub.',
  });
}
