/**
 * Next.js Instrumentation — Startup Hook
 * 
 * Se ejecuta automáticamente cuando Next.js inicia (tanto dev como prod).
 * Aquí registramos:
 * 1. Sistema de migración de BD (db-migration.ts)
 * 2. Auto-backup periódico (auto-backup.ts)
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Ejecutar migraciones pendientes al iniciar
    const { runMigrations } = await import('./lib/db-migration');
    const result = await runMigrations();
    if (result.applied > 0) {
      console.log(`[Startup] ${result.applied} migracion(es) aplicada(s). Version: v${result.version}`);
    }

    // Iniciar auto-backup cada hora
    const { startAutoBackup } = await import('./lib/auto-backup');
    startAutoBackup(60 * 60 * 1000);
  }
}
