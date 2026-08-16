export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Ejecutar migraciones pendientes antes de iniciar
    const { runMigrations } = await import('./src/lib/db-migration');
    runMigrations().then((result) => {
      if (result.applied > 0) {
        console.log(`[Startup] ${result.applied} migracion(es) aplicada(s). BD v${result.version}`);
      }
    }).catch((e) => {
      console.error('[Startup] Error en migraciones:', e);
    });

    // Iniciar auto-backup
    const { startAutoBackup } = await import('./src/lib/auto-backup');
    startAutoBackup(60 * 60 * 1000); // cada hora
  }
}
