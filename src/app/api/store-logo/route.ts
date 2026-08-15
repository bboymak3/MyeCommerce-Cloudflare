import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

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

    // Validar tamano (max 2MB para logo de tienda)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagen demasiado grande. Maximo 2MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Crear directorio si no existe
    const storeDir = join(process.cwd(), 'public', 'store');
    if (!existsSync(storeDir)) {
      await mkdir(storeDir, { recursive: true });
    }

    // Determinar extension correcta basada en el tipo MIME
    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
    };
    const ext = extMap[file.type] || 'png';
    const fileName = `logo.${ext}`;
    const filePath = join(storeDir, fileName);

    // Limpiar archivos logo viejos con otras extensiones
    const validExts = ['png', 'jpg', 'gif', 'webp', 'bmp'];
    try {
      const existing = readdirSync(storeDir);
      for (const f of existing) {
        if (f.startsWith('logo.') && f !== fileName) {
          const oldExt = f.split('.').pop();
          if (oldExt && validExts.includes(oldExt)) {
            unlink(join(storeDir, f)).catch(() => {});
          }
        }
      }
    } catch {}

    await writeFile(filePath, buffer);

    // Retornar la URL publica con extension correcta
    const logoUrl = `/store/logo.${ext}`;
    return NextResponse.json({ url: logoUrl, message: 'Logo guardado correctamente' });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: 'Error al guardar logo' }, { status: 500 });
  }
}
