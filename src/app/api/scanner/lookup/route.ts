import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode') || '';
    if (!barcode) return NextResponse.json({ error: 'Codigo de barras requerido' }, { status: 400 });

    const product = await db.product.findFirst({
      where: {
        active: true,
        OR: [
          { barcode },
          { secondaryBarcode: barcode },
        ]
      },
      include: { category: true, brand: true },
    });

    if (!product) return NextResponse.json({ found: false }, { status: 200 });
    return NextResponse.json({ found: true, product });
  } catch (error) {
    return NextResponse.json({ error: 'Error al buscar producto' }, { status: 500 });
  }
}
