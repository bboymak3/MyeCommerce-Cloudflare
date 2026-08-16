import { db } from './db';
import { mkdir, writeFile, rm, readdir } from 'fs/promises';
import { join } from 'path';
import { getAppVersion } from './version';

const BACKUP_DIR = join(process.cwd(), 'respaldos');
const MAX_BACKUPS = 7;
let backupTimer: NodeJS.Timeout | null = null;

export function startAutoBackup(intervalMs: number = 60 * 60 * 1000) {
  if (backupTimer) clearInterval(backupTimer);

  const run = async () => {
    try {
      await performBackup();
    } catch (e) {
      console.error('[AutoBackup] Error:', e);
    }
  };

  run();
  backupTimer = setInterval(run, intervalMs);
  console.log(`[AutoBackup] Iniciado - cada ${intervalMs / 60000} min`);
}

export function stopAutoBackup() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}

export async function performBackup() {
  await mkdir(BACKUP_DIR, { recursive: true });

  const [
    products, categories, brands, sales, saleItems,
    settings, devolutions, devolutionItems, cashClosings,
    license, users, clients, suppliers, purchases, purchaseItems,
    creditPayments, roleConfigs,
    heldSales, heldSaleItems,
    quotes, quoteItems,
    deliveryNotes, deliveryNoteItems,
    inventoryMovements,
    comboItems,
    expenseCategories, expenses,
  ] = await Promise.all([
    db.product.findMany(),
    db.category.findMany(),
    db.brand.findMany(),
    db.sale.findMany({ orderBy: { date: 'desc' } }),
    db.saleItem.findMany(),
    db.settings.findFirst(),
    db.devolution.findMany({ orderBy: { date: 'desc' } }),
    db.devolutionItem.findMany(),
    db.cashClosing.findMany({ orderBy: { date: 'desc' } }),
    db.license.findFirst(),
    db.user.findMany(),
    db.client.findMany(),
    db.supplier.findMany(),
    db.purchase.findMany({ orderBy: { date: 'desc' } }),
    db.purchaseItem.findMany(),
    db.creditPayment.findMany({ orderBy: { date: 'desc' } }),
    db.roleConfig.findMany(),
    db.heldSale.findMany(),
    db.heldSaleItem.findMany(),
    db.quote.findMany(),
    db.quoteItem.findMany(),
    db.deliveryNote.findMany(),
    db.deliveryNoteItem.findMany(),
    db.inventoryMovement.findMany({ orderBy: { date: 'desc' } }),
    db.comboItem.findMany(),
    db.expenseCategory.findMany(),
    db.expense.findMany({ orderBy: { date: 'desc' } }),
  ]);

  const backup = {
    version: getAppVersion(),
    timestamp: new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
    products,
    categories,
    brands,
    sales,
    saleItems,
    devolutions,
    devolutionItems,
    cashClosings,
    settings,
    license,
    users,
    clients,
    suppliers,
    purchases,
    purchaseItems,
    creditPayments,
    roleConfigs,
    heldSales,
    heldSaleItems,
    quotes,
    quoteItems,
    deliveryNotes,
    deliveryNoteItems,
    inventoryMovements,
    comboItems,
    expenseCategories,
    expenses,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
  const filename = `backup_${dateStr}_${timeStr}.json`;
  const filepath = join(BACKUP_DIR, filename);

  await writeFile(filepath, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`[AutoBackup] Respaldo creado: ${filename}`);

  await cleanupOldBackups();
  return { filename, path: filepath };
}

async function cleanupOldBackups() {
  try {
    const files = await readdir(BACKUP_DIR);
    const backups = files
      .filter((f) => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();

    for (let i = MAX_BACKUPS; i < backups.length; i++) {
      await rm(join(BACKUP_DIR, backups[i]));
      console.log(`[AutoBackup] Eliminado: ${backups[i]}`);
    }
  } catch {}
}
