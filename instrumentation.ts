export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutoBackup } = await import('./src/lib/auto-backup');
    startAutoBackup(60 * 60 * 1000); // cada hora
  }
}
