import { NextRequest, NextResponse } from 'next/server';
import { existsSync, createReadStream } from 'fs';
import { join } from 'path';
import { stat } from 'fs/promises';

// Endpoint para descargar versiones del sistema
// Funciona de 2 maneras:
// 1. Si hay GITHUB_TOKEN: descarga de GitHub archive y lo sirve
// 2. Si no hay token o falla: busca el ZIP en la carpeta local "releases/"
const GITHUB_REPO = 'csglider/MyeCommerce-v2.9.20';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const RELEASES_DIR = join(process.cwd(), 'releases');

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

  // ── OPCIÓN 1: Buscar ZIP en carpeta local "releases/" ──
  const localZipPath = join(RELEASES_DIR, `MyeCommerce-${tagName}.zip`);
  const altZipPath = join(RELEASES_DIR, `${tagName}.zip`);

  let zipPath = '';
  if (existsSync(localZipPath)) {
    zipPath = localZipPath;
  } else if (existsSync(altZipPath)) {
    zipPath = altZipPath;
  }

  if (zipPath) {
    try {
      const fileStat = await stat(zipPath);
      const fileStream = createReadStream(zipPath);
      return new NextResponse(fileStream as any, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="MyeCommerce-${tagName}.zip"`,
          'Content-Length': fileStat.size.toString(),
        },
      });
    } catch {
      // Fallar al leer archivo local, intentar GitHub
    }
  }

  // ── OPCIÓN 2: Descargar de GitHub (si hay token) ──
  if (!GITHUB_TOKEN) {
    return NextResponse.json({
      error: 'No hay token de GitHub configurado y el ZIP no existe localmente.',
      hint: 'Coloque el archivo ZIP en la carpeta "releases/" del sistema.',
    }, { status: 404 });
  }

  const archiveUrl = `https://github.com/${GITHUB_REPO}/archive/refs/tags/${tagName}.zip`;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'MyeCommerce-Download',
      'Authorization': `token ${GITHUB_TOKEN}`,
    };

    const res = await fetch(archiveUrl, {
      redirect: 'follow',
      headers,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error al descargar de GitHub: HTTP ${res.status}. Verifique que la version ${tagName} exista.` },
        { status: res.status }
      );
    }

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
      { error: 'Error al descargar la version. Verifique su conexion a internet.' },
      { status: 500 }
    );
  }
}
