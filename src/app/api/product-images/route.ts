import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

// Buscar en ambas ubicaciones: data/ (nuevo) y public/ (legacy)
const DATA_DIR = join(process.cwd(), 'data', 'uploads', 'products');
const PUBLIC_DIR = join(process.cwd(), 'public', 'uploads', 'products');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get('file');
    if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    // Buscar primero en data/ (nuevo), luego en public/ (legacy)
    let filePath = join(DATA_DIR, file);
    if (!existsSync(filePath)) {
      filePath = join(PUBLIC_DIR, file);
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const ext = file.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
    const contentType = mimeMap[ext || ''] || 'application/octet-stream';
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error serving image' }, { status: 500 });
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (parseError: any) {
      console.error('[product-images] Error parsing formData:', parseError?.message);
      return NextResponse.json({ error: 'Error al procesar la imagen. Intente con una imagen mas pequena (menos de 5MB).' }, { status: 400 });
    }

    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ninguna imagen' }, { status: 400 });
    }

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no soportado. Use JPG, PNG, GIF o WEBP' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json({ error: `Imagen demasiado grande (${sizeMB}MB). Máximo 10MB` }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create directory if it doesn't exist
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }

    // Generate unique filename
    const ext = EXT_MAP[file.type] || 'jpg';
    const fileName = `${randomUUID()}.${ext}`;
    const filePath = join(DATA_DIR, fileName);

    await writeFile(filePath, buffer);

    const imageUrl = `/api/product-images?file=${fileName}`;
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading product image:', error);
    return NextResponse.json({ error: 'Error al guardar la imagen' }, { status: 500 });
  }
}
