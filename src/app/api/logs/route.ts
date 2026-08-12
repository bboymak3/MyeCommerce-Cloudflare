import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { logInfo } from '@/lib/logger';

const LOG_DIR = join(process.cwd(), 'public', 'logs');
const LOG_FILE = join(LOG_DIR, 'system.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB max

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'read';
    const lines = parseInt(searchParams.get('lines') || '200', 10);

    // List available log files
    if (action === 'list') {
      if (!existsSync(LOG_DIR)) {
        return NextResponse.json({ files: [], totalSize: 0 });
      }
      const files = readdirSync(LOG_DIR).filter(f => f.endsWith('.log'));
      const fileInfos = files.map(f => {
        try {
          const stat = statSync(join(LOG_DIR, f));
          return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
        } catch { return { name: f, size: 0, modified: '' }; }
      });
      return NextResponse.json({ files: fileInfos });
    }

    // Read log contents
    if (!existsSync(LOG_FILE)) {
      return NextResponse.json({ content: '// No hay logs aun. Los errores se registraran aqui automaticamente.', size: 0, exists: false });
    }

    const stat = statSync(LOG_FILE);
    const content = readFileSync(LOG_FILE, 'utf-8');
    const allLines = content.split('\n').filter(l => l.trim());
    const recentLines = allLines.slice(-lines);

    // Parse log entries
    const entries = recentLines.map(line => {
      try {
        const match = line.match(/^\[([^\]]+)\]\s+\[(\w+)\]\s+\[([^\]]+)\]\s*(.*)/);
        if (match) {
          return { timestamp: match[1], level: match[2], module: match[3], message: match[4] };
        }
        return { timestamp: '', level: 'INFO', module: 'raw', message: line };
      } catch { return { timestamp: '', level: 'INFO', module: 'raw', message: line }; }
    });

    const errorCount = allLines.filter(l => l.includes('[ERROR]')).length;
    const warnCount = allLines.filter(l => l.includes('[WARN]')).length;
    const infoCount = allLines.filter(l => l.includes('[INFO]')).length;

    return NextResponse.json({
      entries,
      size: stat.size,
      totalLines: allLines.length,
      errorCount,
      warnCount,
      infoCount,
      truncated: allLines.length > lines,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al leer logs: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'clear') {
      if (existsSync(LOG_FILE)) {
        const header = `=== MyeCommerce System Log === Cleared at ${new Date().toISOString()} ===\n`;
        writeFileSync(LOG_FILE, header, 'utf-8');
        logInfo('logs', 'Log limpiado por administrador');
      }
      return NextResponse.json({ success: true, message: 'Log limpiado exitosamente' });
    }

    return NextResponse.json({ error: 'Accion no valida. Use ?action=clear' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al limpiar logs: ' + (error.message || '') }, { status: 500 });
  }
}
