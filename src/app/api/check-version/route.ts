export const runtime = 'edge';
import { NextResponse } from 'next/server';

const GITHUB_REPO = 'csglider/MyeCommerce-v2.9.20';

export async function GET(req: NextRequest) {
  try {
    const localVersion = '2.9.63'; // Keep in sync with package.json
    let versions: any[] = [];
    let status = 'ok';
    let latestVersion = localVersion;
    let hasUpdate = false;

    // Try to fetch from GitHub releases
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MyeCommerce-UpdateCheck',
          },
        }
      );

      if (res.ok) {
        const releases: any[] = (await res.json()).filter((r: any) => !r.draft);
        if (releases.length > 0) {
          versions = releases.map((r) => ({
            version: r.tag_name.replace('v', ''),
            name: r.name || r.tag_name,
            notes: r.body || '',
            date: r.published_at,
            downloadUrl: `/api/download-version?version=${r.tag_name.replace('v', '')}`,
            prerelease: r.prerelease,
            isNewer: true,
          }));
          latestVersion = versions[0].version;
          // Simple version comparison
          const lp = localVersion.split('.').map(Number);
          const tp = latestVersion.split('.').map(Number);
          hasUpdate = tp[0] > lp[0] || (tp[0] === lp[0] && tp[1] > lp[1]) || (tp[0] === lp[0] && tp[1] === lp[1] && tp[2] > lp[2]);
        }
      }
    } catch {
      status = 'no_internet';
    }

    return NextResponse.json({ status, localVersion, latestVersion, hasUpdate, totalVersions: versions.length, versions, githubRepo: GITHUB_REPO });
  } catch {
    return NextResponse.json({ status: 'error', error: 'Error al verificar version' }, { status: 500 });
  }
}
