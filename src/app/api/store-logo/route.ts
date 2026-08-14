import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporciono archivo' }, { status: 400 });
    }

    // Validar tipo
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no soportado. Use PNG, JPG, GIF o WEBP' }, { status: 400 });
    }

    // Validar tamano (max 512KB para impresora termica)
    if (file.size > 512 * 1024) {
      return NextResponse.json({ error: 'Imagen demasiado grande. Maximo 512KB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Crear directorio si no existe
    const storeDir = join(process.cwd(), 'public', 'store');
    if (!existsSync(storeDir)) {
      await mkdir(storeDir, { recursive: true });
    }

    // Guardar con nombre fijo para que siempre se sobreescriba
    const fileName = 'logo.png';
    const filePath = join(storeDir, fileName);

    await writeFile(filePath, buffer);

    // Retornar la URL publica
    const logoUrl = '/store/logo.png';
    return NextResponse.json({ url: logoUrl, message: 'Logo guardado correctamente' });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: 'Error al guardar logo' }, { status: 500 });
  }
}
