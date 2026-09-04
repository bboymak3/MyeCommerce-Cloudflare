export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

const VALID_EXTS = ['png', 'jpg', 'gif', 'webp', 'bmp'];
const LOGO_KEY = 'store/logo';

// GET — serve logo from R2
export async function GET(req: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    const bucket = env.R2_PHOTOS as R2Bucket;
    if (!bucket) {
      return NextResponse.json({ error: 'R2 bucket not configured' }, { status: 500 });
    }

    // Try each extension to find the logo
    for (const ext of VALID_EXTS) {
      const object = await bucket.get(`${LOGO_KEY}.${ext}`);
      if (object) {
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
        };
        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || mimeMap[ext] || 'image/png');
        headers.set('Cache-Control', 'public, max-age=60');
        headers.set('Content-Disposition', `inline; filename="logo.${ext}"`);
        return new NextResponse(object.body, { headers });
      }
    }

    return NextResponse.json({ error: 'No hay logo' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Error al leer logo' }, { status: 500 });
  }
}

// POST — upload logo to R2
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporciono archivo' }, { status: 400 });
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no soportado. Use PNG, JPG, GIF o WEBP' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagen demasiado grande. Maximo 2MB' }, { status: 400 });
    }

    const env = getRequestContext().env as any;
    const bucket = env.R2_PHOTOS as R2Bucket;
    if (!bucket) {
      return NextResponse.json({ error: 'R2 bucket not configured' }, { status: 500 });
    }

    const extMap: Record<string, string> = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp',
    };
    const ext = extMap[file.type] || 'png';
    const key = `${LOGO_KEY}.${ext}`;

    // Delete old logos with different extensions
    for (const oldExt of VALID_EXTS) {
      if (oldExt !== ext) {
        await bucket.delete(`${LOGO_KEY}.${oldExt}`).catch(() => {});
      }
    }

    const bytes = await file.arrayBuffer();
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: file.type || 'image/png' },
    });

    return NextResponse.json({ url: '/api/store-logo', message: 'Logo guardado correctamente' });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: 'Error al guardar logo' }, { status: 500 });
  }
}
