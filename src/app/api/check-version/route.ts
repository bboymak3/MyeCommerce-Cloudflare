import { NextResponse } from 'next/server';

// ─── Configuracion del repositorio ────────────────────────────────
// Cambia esta constante para apuntar a tu repositorio real de GitHub.
// El sistema usara GitHub Releases para listar versiones disponibles.
const GITHUB_REPO = 'csglider/MyeCommerce-v2.9.20';
// Token de acceso para repositorios privados (GitHub Personal Access Token)
// Si el repo es publico, puede dejarse vacio. Si es privado, se necesita el token.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Comparador semver: retorna >0 si a > b, <0 si a < b, 0 si igual
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
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
    if (diffDays < 30) return `hace ${diffDays} dias`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return 'hace 1 mes';
    return `hace ${diffMonths} meses`;
  } catch {
    return dateStr;
  }
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
    } catch {
      // Si no puede leer package.json, la version queda en 0.0.0
    }

    // ── PASO 2: Consultar GitHub Releases API ──
    let status: 'ok' | 'no_internet' | 'repo_not_found' | 'no_releases' = 'ok';
    let versions: Array<{
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
    }> = [];
    let latestVersion = localVersion;
    let hasUpdate = false;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50`,
        {
          next: { revalidate: 60 }, // Cache 1 minuto
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MyeCommerce-UpdateCheck',
            ...(GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {}),
          },
        }
      );

      if (res.status === 404) {
        // El repositorio no existe o es privado
        status = 'repo_not_found';
      } else if (res.status === 403) {
        // Rate limit excedido
        status = 'no_internet';
      } else if (!res.ok) {
        status = 'no_internet';
      } else {
        const releases: Array<{
          tag_name: string;
          name: string;
          body: string;
          published_at: string;
          prerelease: boolean;
          draft: boolean;
          assets: Array<{ name: string; browser_download_url: string }>;
        }> = await res.json();

        // Filtrar releases que no sean draft y tengan formato de version valido
        const validReleases = releases.filter(
          (r) => !r.draft && /^v\d+\.\d+\.\d+$/.test(r.tag_name)
        );

        if (validReleases.length === 0) {
          status = 'no_releases';
        } else {
          // Construir lista de versiones
          versions = validReleases.map((r) => {
            const ver = r.tag_name.replace('v', '');
            const cmp = compareSemver(ver, localVersion);
            // Para repos privados, usar la URL del tag archive (el servidor le agrega el token al descargar)
            const archiveUrl = `https://github.com/${GITHUB_REPO}/archive/refs/tags/${r.tag_name}.zip`;
            return {
              version: ver,
              name: r.name || r.tag_name,
              notes: r.body || '',
              date: r.published_at,
              dateRelative: relativeDate(r.published_at),
              // Siempre usar archive URL (funciona con token en el servidor)
              downloadUrl: archiveUrl,
              tag: r.tag_name,
              prerelease: r.prerelease,
              isNewer: cmp > 0,
              isOlder: cmp < 0,
              isCurrent: cmp === 0,
            };
          });

          // La mas reciente (GitHub ya las devuelve ordenadas por fecha)
          latestVersion = versions[0].version;
          hasUpdate = compareSemver(latestVersion, localVersion) > 0;
          status = 'ok';
        }
      }
    } catch {
      status = 'no_internet';
    }

    // ── PASO 3: Retornar informacion completa ──
    return NextResponse.json({
      status,
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
