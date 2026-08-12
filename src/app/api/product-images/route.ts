import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads', 'products');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get('file');
    if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }
    const filePath = join(UPLOADS_DIR, file);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    const fileBuffer = await readFile(filePath);
    const ext = file.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
    const contentType = mimeMap[ext || ''] || 'application/octet-stream';
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Security-Policy': "default-src 'self'",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error serving image' }, { status: 500 });
  }
}
