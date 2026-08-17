import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { mkdir, cp, rm, readdir, stat } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const GITHUB_REPO = 'csglider/MyeCommerce-v2.9.20';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Carpetas y archivos que se PRESERVAN al actualizar
const PRESERVE_LIST = [
  'prisma/dev.db',
  'prisma/dev.db-wal',
  'prisma/dev.db-shm',
  'prisma/dev.db-journal',
  'data/',
  'BACKUPS/',
  'BACKUP_AUTO_',
  'caddy/caddy.exe',
  'caddy/local-ip.txt',
];

// Archivos/carpetas a copiar de la nueva version
const UPDATE_ITEMS = [
  'src',
  'public',
  'prisma/schema.prisma',
  'prisma/migrations',
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'next.config.js',
  'next.config.ts',
  'tsconfig.json',
  'middleware.ts',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.mjs',
  'postcss.config.js',
  'components.json',
  '.env',
  '.env.local',
  'INSTALAR.bat',
  'INSTALAR-LIMPIO.vbs',
  'INICIAR-TODO.bat',
  'INICIAR-TODO-OCULTO.vbs',
  'DETENER-TODO.bat',
  'RESPALDAR-BD.bat',
  'CREAR-ADMIN.bat',
  'ACTUALIZAR.bat',
  'ACTUALIZAR.vbs',
  'caddy/Caddyfile',
  'caddy/Caddyfile-mobile',
  'printer-agent/agent.js',
];

interface UpdateProgress {
  step: string;
  message: string;
  percent: number;
  backupDir?: string;
}

function sendProgress(controller: ReadableStreamDefaultController, data: UpdateProgress) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const runUpdate = async () => {
        const BASE = process.cwd();

        try {
          // Leer body
          const body = await req.json();
          const targetVersion = body.version;
          const customUrl = body.downloadUrl; // URL directa del release asset (opcional)

          if (!targetVersion) {
            sendProgress(controller, { step: 'error', message: 'Version no especificada', percent: 0 });
            controller.close();
            return;
          }

          // ── PASO 1: Verificar prerequisitos ──
          sendProgress(controller, { step: 'check', message: 'Verificando sistema...', percent: 5 });

          if (!existsSync(join(BASE, 'prisma', 'dev.db'))) {
            sendProgress(controller, { step: 'error', message: 'No se encontro base de datos. Sistema no instalado.', percent: 0 });
            controller.close();
            return;
          }

          // Leer version local
          let localVersion = '0.0.0';
          try {
            const fsSync = await import('fs');
            const pkg = JSON.parse(fsSync.readFileSync(join(BASE, 'package.json'), 'utf-8'));
            localVersion = pkg.version || '0.0.0';
          } catch {}

          // Verificar si es un rollback (version anterior)
          const isRollback = customUrl ? true : false;
          const localParts = localVersion.split('.').map(Number);
          const targetParts = targetVersion.split('.').map(Number);
          let isDowngrade = false;
          for (let i = 0; i < 3; i++) {
            if ((targetParts[i] || 0) < (localParts[i] || 0)) {
              isDowngrade = true;
              break;
            } else if ((targetParts[i] || 0) > (localParts[i] || 0)) {
              break;
            }
          }

          const actionLabel = isDowngrade ? `RESTAURANDO a v${targetVersion} (version anterior)` : `Actualizando a v${targetVersion}`;
          sendProgress(controller, { step: 'check', message: `Version actual: v${localVersion} → ${actionLabel}`, percent: 10 });

          // ── PASO 2: Respaldar ──
          sendProgress(controller, { step: 'backup', message: 'Creando respaldo de seguridad...', percent: 15 });

          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
          const backupLabel = isDowngrade ? `ROLLBACK` : `PRE-ACTUALIZACION`;
          const backupDir = join(BASE, `BACKUP_AUTO_${backupLabel}_v${localVersion}_${dateStr}`);

          if (!existsSync(backupDir)) await mkdir(backupDir, { recursive: true });

          // Respaldar BD
          const dbFiles = ['dev.db', 'dev.db-wal', 'dev.db-shm', 'dev.db-journal'];
          for (const f of dbFiles) {
            const src = join(BASE, 'prisma', f);
            if (existsSync(src)) {
              try { await cp(src, join(backupDir, f)); } catch {}
            }
          }

          // Respaldar schema
          const schemaSrc = join(BASE, 'prisma', 'schema.prisma');
          if (existsSync(schemaSrc)) {
            try { await cp(schemaSrc, join(backupDir, 'schema.prisma')); } catch {}
          }

          // Respaldar uploads
          const uploadsDir = join(BASE, 'data', 'uploads');
          if (existsSync(uploadsDir)) {
            try { await cp(uploadsDir, join(backupDir, 'uploads'), { recursive: true }); } catch {}
          }

          // Respaldar package.json
          const pkgSrc = join(BASE, 'package.json');
          if (existsSync(pkgSrc)) {
            try { await cp(pkgSrc, join(backupDir, 'package.json')); } catch {}
          }

          sendProgress(controller, { step: 'backup', message: `Respaldo completado en ${backupDir}`, percent: 25, backupDir });

          // ── PASO 3: Descargar version ──
          const tagName = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
          // Si hay URL custom (del release asset), usarla; si no, usar archive de GitHub
          const downloadUrl = customUrl || `https://github.com/${GITHUB_REPO}/archive/refs/tags/${tagName}.zip`;
          const tempZip = join(BASE, 'temp_online_update.zip');

          sendProgress(controller, { step: 'download', message: `Descargando v${targetVersion}...`, percent: 30 });

          // Descargar con fetch nativo
          const res = await fetch(downloadUrl, { redirect: 'follow', headers: { ...(GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {}) } });
          if (!res.ok || !res.body) {
            sendProgress(controller, {
              step: 'error',
              message: `Error al descargar v${targetVersion}: HTTP ${res.status}. Verifique que la version exista en GitHub.`,
              percent: 0,
            });
            controller.close();
            return;
          }

          // Stream a archivo
          const fsSync = await import('fs');
          const fileStream = fsSync.createWriteStream(tempZip);
          await pipeline(Readable.fromWeb(res.body as any), fileStream);

          // Verificar tamaño minimo (100KB)
          const zipStat = await stat(tempZip);
          if (zipStat.size < 100000) {
            sendProgress(controller, {
              step: 'error',
              message: `Archivo descargado solo ${Math.round(zipStat.size / 1024)}KB (minimo 100KB). Posible error de version o URL incorrecta.`,
              percent: 0,
            });
            try { await rm(tempZip); } catch {}
            controller.close();
            return;
          }

          sendProgress(controller, { step: 'download', message: `Descargado (${(zipStat.size / 1024 / 1024).toFixed(1)} MB)`, percent: 50 });

          // ── PASO 4: Extraer ZIP ──
          sendProgress(controller, { step: 'extract', message: 'Extrayendo archivos...', percent: 55 });

          const tempExtract = join(BASE, 'temp_online_extract');
          if (existsSync(tempExtract)) await rm(tempExtract, { recursive: true });
          await mkdir(tempExtract, { recursive: true });

          try {
            execSync(
              `powershell -NoProfile -Command "Expand-Archive -Path '${tempZip.replace(/'/g, "''")}' -DestinationPath '${tempExtract.replace(/'/g, "''")}' -Force"`,
              { cwd: BASE, timeout: 120000, stdio: 'pipe' }
            );
          } catch (err: any) {
            sendProgress(controller, { step: 'error', message: 'Error al extraer ZIP. Verifique que el archivo no este corrupto.', percent: 0 });
            try { await rm(tempZip); } catch {}
            controller.close();
            return;
          }

          // Encontrar la carpeta del repo extraida
          const extractEntries = await readdir(tempExtract);
          let extractedDir = '';
          for (const entry of extractEntries) {
            const fullPath = join(tempExtract, entry);
            const s = await stat(fullPath);
            if (s.isDirectory() && entry.includes('MyeCommerce')) {
              extractedDir = fullPath;
              break;
            }
          }

          if (!extractedDir) {
            for (const entry of extractEntries) {
              const fullPath = join(tempExtract, entry);
              const s = await stat(fullPath);
              if (s.isDirectory()) { extractedDir = fullPath; break; }
            }
          }

          if (!extractedDir) {
            sendProgress(controller, { step: 'error', message: 'No se pudo encontrar la carpeta extraida del ZIP.', percent: 0 });
            try { await rm(tempZip); await rm(tempExtract, { recursive: true }); } catch {}
            controller.close();
            return;
          }

          sendProgress(controller, { step: 'extract', message: 'Archivos extraidos', percent: 60 });

          // ── PASO 5: Copiar archivos nuevos ──
          sendProgress(controller, { step: 'copy', message: 'Actualizando archivos del sistema...', percent: 65 });

          let copied = 0;
          let errors = 0;
          for (const item of UPDATE_ITEMS) {
            const srcPath = join(extractedDir, item);
            if (!existsSync(srcPath)) continue;

            const destPath = join(BASE, item);

            try {
              const s = await stat(srcPath);
              if (s.isDirectory()) {
                if (existsSync(destPath)) await rm(destPath, { recursive: true });
                await cp(srcPath, destPath, { recursive: true });
              } else {
                const parentDir = join(destPath, '..');
                if (!existsSync(parentDir)) await mkdir(parentDir, { recursive: true });
                await cp(srcPath, destPath);
              }
              copied++;
            } catch (err: any) {
              console.warn(`[update] Error copiando ${item}:`, err?.message);
              errors++;
            }
          }

          // Crear carpetas data si no existen
          const dataDirs = ['data', 'data/uploads', 'data/uploads/products', 'data/uploads/thumbs'];
          for (const d of dataDirs) {
            const dp = join(BASE, d);
            if (!existsSync(dp)) await mkdir(dp, { recursive: true });
          }

          sendProgress(controller, { step: 'copy', message: `${copied} elementos actualizados (${errors} errores)`, percent: 75 });

          // ── PASO 6: Limpiar temporales ──
          sendProgress(controller, { step: 'cleanup', message: 'Limpiando archivos temporales...', percent: 80 });
          try { await rm(tempZip); } catch {}
          try { await rm(tempExtract, { recursive: true }); } catch {}

          // ── PASO 7: Migrar base de datos ──
          sendProgress(controller, { step: 'migrate', message: 'Migrando base de datos...', percent: 85 });

          try {
            execSync('npx prisma generate', { cwd: BASE, timeout: 60000, stdio: 'pipe' });
          } catch (err: any) {
            console.warn('[update] prisma generate warning:', err?.message);
          }

          try {
            execSync('npx prisma db push --accept-data-loss', { cwd: BASE, timeout: 60000, stdio: 'pipe' });
          } catch {
            try {
              execSync('npx prisma migrate deploy', { cwd: BASE, timeout: 60000, stdio: 'pipe' });
            } catch (err2: any) {
              console.warn('[update] migration warning:', err2?.message);
            }
          }

          sendProgress(controller, { step: 'migrate', message: 'Base de datos migrada', percent: 90 });

          // ── PASO 8: Completado ──
          const finalMsg = isDowngrade
            ? `RESTAURADO a v${targetVersion} desde v${localVersion}. Respaldado en: ${backupDir}`
            : `Actualizado de v${localVersion} a v${targetVersion}. Respaldado en: ${backupDir}`;

          sendProgress(controller, {
            step: 'complete',
            message: finalMsg,
            percent: 100,
            backupDir,
          });

          controller.close();

        } catch (err: any) {
          console.error('[update] Error:', err);
          sendProgress(controller, {
            step: 'error',
            message: `Error inesperado: ${err?.message || 'Desconocido'}`,
            percent: 0,
          });
          controller.close();
        }
      };

      runUpdate();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
