import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibio ninguna imagen' }, { status: 400 });
    }

    // Validar tipo de archivo
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no valido. Use JPG, PNG, GIF, WebP o SVG' }, { status: 400 });
    }

    // Validar tamaño (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'La imagen es muy grande. Maximo 5MB' }, { status: 400 });
    }

    // Generar nombre unico
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase() || '.jpg';
    const fileName = `${randomUUID()}${ext}`;
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'products');

    // Asegurar que el directorio existe
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Escribir archivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(join(uploadsDir, fileName), buffer);

    // Retornar URL relativa (accesible via /uploads/products/filename)
    const imageUrl = `/uploads/products/${fileName}`;

    return NextResponse.json({ imageUrl, fileName });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Error al subir imagen: ' + (error.message || 'Error desconocido') }, { status: 500 });
  }
}
