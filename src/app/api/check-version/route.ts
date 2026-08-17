import { NextResponse } from 'next/server';

// ─── Configuracion ──────────────────────────────────────────────────
const GITHUB_REPO = 'csglider/MyeCommerce-v2.9.20';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Comparador semver: retorna >0 si a > b, <0 si a < b, 0 si igual
function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// Formatear fecha relativa (hace X dias)
function relativeDate(dateStr: string): string {
  try {
    const then = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'ayer';
    if (diffDays < 0) return 'reciente';
    if (diffDays < 30) return `hace ${diffDays} dias`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return 'hace 1 mes';
    return `hace ${diffMonths} meses`;
  } catch {
    return dateStr;
  }
}

// Formato estandar de version para la interfaz
interface VersionEntry {
  version: string;
  name: string;
  notes: string;
  date: string;
  dateRelative: string;
  downloadUrl: string;
  prerelease: boolean;
  isNewer: boolean;
  isOlder: boolean;
  isCurrent: boolean;
}

export async function GET() {
  try {
    // ── PASO 1: Leer version local desde package.json ──
    let localVersion = '0.0.0';
    try {
      const fs = await import('fs');
      const path = await import('path');
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      localVersion = pkg.version || '0.0.0';
    } catch {}

    let versions: VersionEntry[] = [];
    let status: 'ok' | 'no_internet' | 'repo_not_found' | 'no_releases' | 'local_only' = 'ok';
    let source: 'github' | 'local' = 'local';
    let latestVersion = localVersion;
    let hasUpdate = false;

    // ── PASO 2: Intentar GitHub Releases (primario si hay token) ──
    if (GITHUB_TOKEN) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50`,
          {
            next: { revalidate: 60 },
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'MyeCommerce-UpdateCheck',
              'Authorization': `token ${GITHUB_TOKEN}`,
            },
          }
        );

        if (res.ok) {
          const releases: Array<{
            tag_name: string;
            name: string;
            body: string;
            published_at: string;
            prerelease: boolean;
            draft: boolean;
          }> = await res.json();

          const validReleases = releases.filter((r) => !r.draft);

          if (validReleases.length > 0) {
            versions = validReleases.map((r) => {
              const ver = r.tag_name.replace('v', '');
              const cmp = compareSemver(ver, localVersion);
              const archiveUrl = `https://github.com/${GITHUB_REPO}/archive/refs/tags/${r.tag_name}.zip`;
              return {
                version: ver,
                name: r.name || r.tag_name,
                notes: r.body || '',
                date: r.published_at,
                dateRelative: relativeDate(r.published_at),
                downloadUrl: archiveUrl,
                prerelease: r.prerelease,
                isNewer: cmp > 0,
                isOlder: cmp < 0,
                isCurrent: cmp === 0,
              };
            });
            source = 'github';
          }
        }
      } catch {
        // GitHub fallo, intentar local
      }
    }

    // ── PASO 3: Leer versiones locales (versions.json) como respaldo ──
    if (versions.length === 0) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const versionsPath = path.join(process.cwd(), 'public', 'versions.json');
        const versionsContent = fs.readFileSync(versionsPath, 'utf-8');
        const versionsData = JSON.parse(versionsContent);

        if (versionsData.versiones && Array.isArray(versionsData.versiones)) {
          // Ordenar por version descendente (mas reciente primero)
          const sorted = [...versionsData.versiones].sort((a, b) =>
            compareSemver(b.version, a.version)
          );

          versions = sorted.map((v: { version: string; nombre: string; notas: string; fecha: string; tipo: string }) => {
            const cmp = compareSemver(v.version, localVersion);
            return {
              version: v.version,
              name: v.nombre || `v${v.version}`,
              notes: v.notas || '',
              date: v.fecha || '',
              dateRelative: relativeDate(v.fecha),
              downloadUrl: `/api/download-version?version=${v.version}`,
              prerelease: v.tipo === 'beta' || v.tipo === 'prerelease',
              isNewer: cmp > 0,
              isOlder: cmp < 0,
              isCurrent: cmp === 0,
            };
          });

          source = 'local';
          if (GITHUB_TOKEN) {
            status = 'local_only'; // Tiene token pero GitHub fallo, uso local
          }
        }
      } catch {
        // No hay versions.json
      }
    }

    // ── PASO 4: Si no hay versiones de ninguna fuente ──
    if (versions.length === 0) {
      if (!GITHUB_TOKEN) {
        status = 'no_releases';
      } else {
        status = 'repo_not_found';
      }
    }

    // ── PASO 5: Determinar version mas reciente y si hay actualizacion ──
    if (versions.length > 0) {
      latestVersion = versions[0].version;
      hasUpdate = compareSemver(latestVersion, localVersion) > 0;
      if (status === 'ok') status = 'ok';
    }

    return NextResponse.json({
      status,
      source,
      localVersion,
      latestVersion,
      hasUpdate,
      totalVersions: versions.length,
      versions,
      githubRepo: GITHUB_REPO,
      releasesUrl: `https://github.com/${GITHUB_REPO}/releases`,
    });
  } catch {
    return NextResponse.json(
      { status: 'error', error: 'Error interno al verificar version' },
      { status: 500 }
    );
  }
}
