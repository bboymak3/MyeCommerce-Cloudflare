export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

// R2 bucket name configured in wrangler.toml
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
};

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET — serve product image from R2
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get('file');
    const isThumb = searchParams.get('thumb') === 'true';

    if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    const env = getRequestContext().env as any;
    const bucket = env.R2_PHOTOS as R2Bucket;
    if (!bucket) {
      return NextResponse.json({ error: 'R2 bucket not configured' }, { status: 500 });
    }

    const key = isThumb ? `thumbs/t_${file}` : `products/${file}`;
    let object = await bucket.get(key);

    // Fallback to just the filename
    if (!object) {
      object = await bucket.get(file);
    }

    if (!object) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const ext = file.split('.').pop()?.toLowerCase();
    const contentType = object.httpMetadata?.contentType || MIME_MAP[ext || ''] || 'application/octet-stream';

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', isThumb ? 'public, max-age=604800, immutable' : 'public, max-age=86400');
    headers.set('Access-Control-Allow-Origin', '*');
    return new NextResponse(object.body, { headers });
  } catch (error) {
    console.error('Product image error:', error);
    return NextResponse.json({ error: 'Error al obtener imagen' }, { status: 500 });
  }
}

// POST — upload product image to R2
export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Error al procesar la imagen. Intente con una imagen mas pequena.' }, { status: 400 });
    }

    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No se proporciono ninguna imagen' }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no soportado. Use JPG, PNG, GIF o WEBP' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json({ error: `Imagen demasiado grande (${sizeMB}MB). Maximo 10MB` }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'El archivo esta vacio' }, { status: 400 });
    }

    const env = getRequestContext().env as any;
    const bucket = env.R2_PHOTOS as R2Bucket;
    if (!bucket) {
      return NextResponse.json({ error: 'R2 bucket not configured' }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const ext = EXT_MAP[file.type] || 'jpg';
    const fileName = `${generateId()}.${ext}`;

    await bucket.put(`products/${fileName}`, bytes, {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    });

    const imageUrl = `/api/product-images?file=${fileName}`;
    return NextResponse.json({ imageUrl, thumbUrl: `/api/product-images?file=${fileName}&thumb=true` });
  } catch (error) {
    console.error('Error uploading product image:', error);
    return NextResponse.json({ error: 'Error al guardar la imagen' }, { status: 500 });
  }
}

// DELETE — remove image from R2
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get('file');
    if (!file) {
      return NextResponse.json({ error: 'File name required' }, { status: 400 });
    }

    const env = getRequestContext().env as any;
    const bucket = env.R2_PHOTOS as R2Bucket;
    if (!bucket) {
      return NextResponse.json({ error: 'R2 bucket not configured' }, { status: 500 });
    }

    await bucket.delete(`products/${file}`);
    await bucket.delete(`thumbs/t_${file}`).catch(() => {});

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Image delete error:', error);
    return NextResponse.json({ error: 'Error al eliminar imagen' }, { status: 500 });
  }
}
