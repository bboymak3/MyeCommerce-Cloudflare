import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporciono imagen' }, { status: 400 });
    }

    // Validar tipo
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no soportado. Use PNG, JPG, GIF o WEBP' }, { status: 400 });
    }

    // Validar tamano (max 2MB para producto)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagen demasiado grande. Maximo 2MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generar nombre unico con extension
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `${randomUUID().slice(0, 8)}.${ext}`;
    const filePath = join(process.cwd(), 'public', 'products', fileName);

    await writeFile(filePath, buffer);

    // Retornar URL publica
    const imageUrl = `/products/${fileName}`;
    return NextResponse.json({ imageUrl, message: 'Imagen guardada' });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
  }
}
