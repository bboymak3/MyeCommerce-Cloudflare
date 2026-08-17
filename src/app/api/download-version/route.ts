import { NextRequest, NextResponse } from 'next/server';

// Endpoint proxy para descargar ZIPs de GitHub (necesario para repos privados)
// El navegador del usuario no tiene el token de GitHub, pero este endpoint sí.
const GITHUB_REPO = 'csglider/MyeCommerce-v2.9.20';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const version = searchParams.get('version');

  if (!version) {
    return NextResponse.json({ error: 'Version no especificada' }, { status: 400 });
  }

  // Sanitizar: solo permitir formato semver
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return NextResponse.json({ error: 'Formato de version invalido' }, { status: 400 });
  }

  const tagName = `v${version}`;
  const archiveUrl = `https://github.com/${GITHUB_REPO}/archive/refs/tags/${tagName}.zip`;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'MyeCommerce-Download',
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    const res = await fetch(archiveUrl, {
      redirect: 'follow',
      headers,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error al descargar: HTTP ${res.status}` },
        { status: res.status }
      );
    }

    // Obtener el contenido como buffer y servirlo
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="MyeCommerce-${tagName}.zip"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Error al descargar la version' },
      { status: 500 }
    );
  }
}
