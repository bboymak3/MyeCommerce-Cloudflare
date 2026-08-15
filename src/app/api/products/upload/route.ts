import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Guardar FUERA de public/ para evitar problemas con next build/cache
const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads', 'products');

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

    // Validar tamano (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagen demasiado grande. Maximo 2MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Crear directorio si no existe
    if (!existsSync(UPLOADS_DIR)) {
      await mkdir(UPLOADS_DIR, { recursive: true });
    }

    // Generar nombre unico para evitar colisiones
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = join(UPLOADS_DIR, fileName);

    await writeFile(filePath, buffer);

    // Retornar URL a traves del API endpoint (siempre funciona, sin depender de public/)
    const imageUrl = `/api/product-images?file=${fileName}`;
    return NextResponse.json({ imageUrl, message: 'Imagen subida correctamente' });
  } catch (error) {
    console.error('Error uploading product image:', error);
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
  }
}
