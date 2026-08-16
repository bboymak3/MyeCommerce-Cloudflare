import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

const STORE_DIR = () => join(process.cwd(), 'public', 'store');
const VALID_EXTS = ['png', 'jpg', 'gif', 'webp', 'bmp'];

function findLogoFile(): string | null {
  const dir = STORE_DIR();
  if (!existsSync(dir)) return null;
  try {
    const files = readdirSync(dir);
    for (const ext of VALID_EXTS) {
      const name = `logo.${ext}`;
      if (files.includes(name)) return join(dir, name);
    }
  } catch {}
  return null;
}

// GET — serve logo from filesystem (avoids Next.js static cache issues)
export async function GET() {
  try {
    const logoPath = findLogoFile();
    if (!logoPath) {
      return NextResponse.json({ error: 'No hay logo' }, { status: 404 });
    }
    const buffer = await readFile(logoPath);
    const ext = logoPath.split('.').pop() || 'png';
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    };
    // Cache for 60 seconds so browser refreshes get updates
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeMap[ext] || 'image/png',
        'Cache-Control': 'public, max-age=60',
        'Content-Disposition': `inline; filename="logo.${ext}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Error al leer logo' }, { status: 500 });
  }
}

// POST — upload logo
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
    const storeDir = STORE_DIR();
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
    try {
      const existing = readdirSync(storeDir);
      for (const f of existing) {
        if (f.startsWith('logo.') && f !== fileName) {
          const oldExt = f.split('.').pop();
          if (oldExt && VALID_EXTS.includes(oldExt)) {
            unlink(join(storeDir, f)).catch(() => {});
          }
        }
      }
    } catch {}

    await writeFile(filePath, buffer);

    // Retornar la URL via API route para evitar cache de static files
    const logoUrl = `/api/store-logo`;
    return NextResponse.json({ url: logoUrl, message: 'Logo guardado correctamente' });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: 'Error al guardar logo' }, { status: 500 });
  }
}
