import { NextResponse } from 'next/server';

const GITHUB_REPO = 'csglider/MyeCommerce-v2.9.20';

export async function GET() {
  try {
    // Leer versión local desde package.json
    let localVersion = '0.0.0';
    try {
      const fs = await import('fs');
      const path = await import('path');
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      localVersion = pkg.version || '0.0.0';
    } catch {
      // Si no puede leer package.json
    }

    // Consultar última versión en GitHub
    let latestVersion = localVersion;
    let downloadUrl = '';
    let hasUpdate = false;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=10`,
        { next: { revalidate: 300 } } // Cache 5 min
      );

      if (res.ok) {
        const tags: Array<{ name: string; commit?: { sha: string } }> = await res.json();

        if (tags.length > 0) {
          // Filtrar tags de versión (formato v2.9.XX)
          const versionTags = tags
            .filter((t) => /^v\d+\.\d+\.\d+$/.test(t.name))
            .map((t) => t.name.replace('v', ''));

          if (versionTags.length > 0) {
            latestVersion = versionTags[0]; // La más reciente
            const tagName = 'v' + latestVersion;
            downloadUrl = `https://github.com/${GITHUB_REPO}/archive/refs/tags/${tagName}.zip`;

            // Comparar versiones: semantic version simple
            const localParts = localVersion.split('.').map(Number);
            const latestParts = latestVersion.split('.').map(Number);

            hasUpdate = false;
            for (let i = 0; i < 3; i++) {
              if ((latestParts[i] || 0) > (localParts[i] || 0)) {
                hasUpdate = true;
                break;
              }
            }
          }
        }
      }
    } catch {
      // Si no puede consultar GitHub, no muestra actualización
    }

    return NextResponse.json({
      localVersion,
      latestVersion,
      hasUpdate,
      downloadUrl,
      githubRepo: GITHUB_REPO,
      releasesUrl: `https://github.com/${GITHUB_REPO}/releases`,
    });
  } catch {
    return NextResponse.json({ error: 'Error al verificar version' }, { status: 500 });
  }
}
