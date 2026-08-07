import { NextResponse } from 'next/server';
import { performBackup } from '@/lib/auto-backup';
import { readdir } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const backupDir = join(process.cwd(), 'respaldos');
    let files: string[] = [];
    try {
      files = (await readdir(backupDir))
        .filter((f) => f.startsWith('backup_') && f.endsWith('.json'))
        .sort()
        .reverse();
    } catch {}
    return NextResponse.json({ status: 'active', backups: files, total: files.length });
  } catch {
    return NextResponse.json({ status: 'active', backups: [], total: 0 });
  }
}

export async function POST() {
  try {
    const result = await performBackup();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: 'Error al forzar respaldo' }, { status: 500 });
  }
}
