export const runtime = 'edge';
import { NextResponse } from 'next/server';

// On Cloudflare Edge, automatic file-based backups are not supported.
// Backup/restore is handled via the /api/backup endpoint (JSON export/import).
export async function GET() {
  return NextResponse.json({ status: 'active', backups: [], total: 0, note: 'File-based backups not available on Cloudflare. Use /api/backup for JSON export.' });
}

export async function POST() {
  return NextResponse.json({ success: true, note: 'Auto-backup not available on Cloudflare. Use /api/backup for JSON export.' });
}
