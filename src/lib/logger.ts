// Sistema de logging centralizado para MyeCommerce
// Escribe logs en /public/logs/system.log (accesible via /api/logs)
// Los errores se guardan en archivo y se pueden consultar desde la app

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), 'public', 'logs');
const LOG_FILE = join(LOG_DIR, 'system.log');

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
  userId?: string;
  [key: string]: any;
}

function formatEntry(entry: LogEntry): string {
  const dataStr = entry.data ? ' | DATA: ' + JSON.stringify(entry.data, null, 0) : '';
  return `[${entry.timestamp}] [${entry.level}] [${entry.module}]${entry.userId ? ' [UID:' + entry.userId + ']' : ''} ${entry.message}${dataStr}`;
}

export function log(level: LogLevel, module: string, message: string, data?: any, userId?: string) {
  try {
    ensureLogDir();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      ...(data !== undefined ? { data } : {}),
      ...(userId ? { userId } : {}),
    };
    const line = formatEntry(entry) + '\n';
    appendFileSync(LOG_FILE, line, 'utf-8');

    // También imprimir en consola del servidor
    const consoleFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    consoleFn(`[${module}] ${message}`, data || '');
  } catch {
    // Si falla el logging, no romper la app
  }
}

export function logError(module: string, message: string, error?: any, userId?: string) {
  const errData = error
    ? { errorMessage: error.message, stack: error.stack?.substring(0, 500) }
    : undefined;
  log('ERROR', module, message, errData, userId);
}

export function logInfo(module: string, message: string, data?: any, userId?: string) {
  log('INFO', module, message, data, userId);
}

export function logWarn(module: string, message: string, data?: any, userId?: string) {
  log('WARN', module, message, data, userId);
}

export function logDebug(module: string, message: string, data?: any) {
  if (process.env.NODE_ENV === 'development') {
    log('DEBUG', module, message, data);
  }
}
