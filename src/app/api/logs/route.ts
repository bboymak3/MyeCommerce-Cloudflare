export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';

// On Cloudflare Edge, file-based logs are not available.
// Use Cloudflare Workers Logs or external logging service.
export async function GET(req: NextRequest) {
  return NextResponse.json({ entries: [], size: 0, totalLines: 0, errorCount: 0, warnCount: 0, infoCount: 0, exists: false, note: 'File-based logs not available on Cloudflare Edge.' });
}

export async function DELETE() {
  return NextResponse.json({ success: true, message: 'Log clearing not available on Cloudflare.' });
}
