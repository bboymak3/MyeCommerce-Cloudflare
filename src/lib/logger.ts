// Sistema de logging para Edge Runtime
// On Cloudflare, logs go to console (use Cloudflare Workers Logs for persistence)

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export function log(level: LogLevel, module: string, message: string, data?: any, userId?: string) {
  const consoleFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  const prefix = userId ? `[${module}] [UID:${userId}]` : `[${module}]`;
  consoleFn(`${prefix} ${message}`, data || '');
}

export function logError(module: string, message: string, error?: any, userId?: string) {
  const errData = error ? { errorMessage: error.message, stack: error.stack?.substring(0, 500) } : undefined;
  log('ERROR', module, message, errData, userId);
}

export function logInfo(module: string, message: string, data?: any, userId?: string) {
  log('INFO', module, message, data, userId);
}

export function logWarn(module: string, message: string, data?: any, userId?: string) {
  log('WARN', module, message, data, userId);
}

export function logDebug(module: string, message: string, data?: any) {
  log('DEBUG', module, message, data);
}
