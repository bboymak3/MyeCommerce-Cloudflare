import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function safeFloat(v: any, fallback: number = 0): number {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

export async function GET() {
  try {
    const products = await db.product.findMany({
      where: { active: true },
      include: {
        category: true,
        brand: true,
        comboItems: { include: { product: { select: { id: true, name: true, barcode: true, price: true, stock: true } } } },
        comboItemsRef: { include: { combo: { select: { id: true, name: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Nombre del producto es requerido' }, { status: 400 });
    }
    const price = safeFloat(body.price, NaN);
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ error: 'Precio del producto es requerido y debe ser mayor o igual a cero' }, { status: 400 });
    }
    const cost = safeFloat(body.cost, 0);
    const stock = safeFloat(body.stock, 0);
    const minStock = safeFloat(body.minStock, 5);
    const wholesalePrice = safeFloat(body.wholesalePrice, 0);
    const unitsPerBox = Math.max(0, parseInt(body.unitsPerBox || 0));
    const boxPrice = safeFloat(body.boxPrice, 0);
    const boxMarginPercent = safeFloat(body.boxMarginPercent, 0);

    const product = await db.product.create({
      data: {
        name: body.name.trim(),
        description: body.description || '',
        barcode: body.barcode || '',
        secondaryBarcode: body.secondaryBarcode || '',
        price,
        cost: Math.max(0, cost),
        marginPercent: Math.max(0, safeFloat(body.marginPercent, 0)),
        taxType: body.taxType || 'exento',
        stock: Math.max(0, stock),
        minStock: Math.max(0, minStock),
        categoryId: body.categoryId || null,
        brandId: body.brandId || null,
        icon: body.icon || '',
        image: body.image || '',
        noStock: body.noStock === true,
        wholesalePrice: Math.max(0, wholesalePrice),
        wholesaleCost: Math.max(0, safeFloat(body.wholesaleCost, 0)),
        wholesaleMarginPercent: Math.max(0, safeFloat(body.wholesaleMarginPercent, 0)),
        minWholesaleQty: Math.max(0, parseInt(body.minWholesaleQty || 0)),
        granMayorPrice: Math.max(0, safeFloat(body.granMayorPrice, 0)),
        isGranMayor: body.isGranMayor === true,
        vendePorPeso: body.vendePorPeso === true,
        unidadPeso: body.unidadPeso || '',
        location: body.location || '',
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        lotNumber: body.lotNumber || '',
        isCombo: body.isCombo === true,
        loyaltyPoints: Math.max(0, parseInt(body.loyaltyPoints || 0)),
        unitsPerBox,
        boxPrice: Math.max(0, boxPrice),
        boxMarginPercent: Math.max(0, boxMarginPercent),
      },
      include: {
        category: true,
        brand: true,
        comboItems: { include: { product: { select: { id: true, name: true, barcode: true, price: true, stock: true } } } },
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'ID del producto es requerido' }, { status: 400 });
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: 'Nombre del producto es requerido' }, { status: 400 });
    }
    const price = safeFloat(body.price, NaN);
    if (body.price !== undefined && (isNaN(price) || price < 0)) {
      return NextResponse.json({ error: 'Precio invalido' }, { status: 400 });
    }

    const product = await db.product.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim(),
        description: body.description !== undefined ? body.description : undefined,
        barcode: body.barcode !== undefined ? body.barcode : undefined,
        price: isNaN(price) ? undefined : price,
        cost: body.cost !== undefined ? Math.max(0, safeFloat(body.cost, 0)) : undefined,
        stock: body.stock !== undefined ? Math.max(0, safeFloat(body.stock, 0)) : undefined,
        minStock: body.minStock !== undefined ? Math.max(0, safeFloat(body.minStock, 5)) : undefined,
        categoryId: body.categoryId !== undefined ? (body.categoryId || null) : undefined,
        brandId: body.brandId !== undefined ? (body.brandId || null) : undefined,
        active: body.active !== undefined ? body.active : true,
        icon: body.icon !== undefined ? body.icon : undefined,
        noStock: body.noStock !== undefined ? body.noStock === true : undefined,
        wholesalePrice: body.wholesalePrice !== undefined ? Math.max(0, safeFloat(body.wholesalePrice, 0)) : undefined,
        wholesaleCost: body.wholesaleCost !== undefined ? Math.max(0, safeFloat(body.wholesaleCost, 0)) : undefined,
        wholesaleMarginPercent: body.wholesaleMarginPercent !== undefined ? Math.max(0, safeFloat(body.wholesaleMarginPercent, 0)) : undefined,
        minWholesaleQty: body.minWholesaleQty !== undefined ? Math.max(0, parseInt(body.minWholesaleQty || 0)) : undefined,
        granMayorPrice: body.granMayorPrice !== undefined ? Math.max(0, safeFloat(body.granMayorPrice, 0)) : undefined,
        isGranMayor: body.isGranMayor !== undefined ? body.isGranMayor === true : undefined,
        vendePorPeso: body.vendePorPeso !== undefined ? body.vendePorPeso === true : undefined,
        unidadPeso: body.unidadPeso !== undefined ? body.unidadPeso : undefined,
        secondaryBarcode: body.secondaryBarcode !== undefined ? body.secondaryBarcode : undefined,
        marginPercent: body.marginPercent !== undefined ? Math.max(0, safeFloat(body.marginPercent, 0)) : undefined,
        taxType: body.taxType !== undefined ? body.taxType : undefined,
        image: body.image !== undefined ? body.image : undefined,
        location: body.location !== undefined ? body.location : undefined,
        expirationDate: body.expirationDate !== undefined ? (body.expirationDate ? new Date(body.expirationDate) : null) : undefined,
        lotNumber: body.lotNumber !== undefined ? body.lotNumber : undefined,
        isCombo: body.isCombo !== undefined ? body.isCombo === true : undefined,
        loyaltyPoints: body.loyaltyPoints !== undefined ? Math.max(0, parseInt(body.loyaltyPoints || 0)) : undefined,
        unitsPerBox: body.unitsPerBox !== undefined ? Math.max(0, parseInt(body.unitsPerBox || 0)) : undefined,
        boxPrice: body.boxPrice !== undefined ? Math.max(0, safeFloat(body.boxPrice, 0)) : undefined,
        boxMarginPercent: body.boxMarginPercent !== undefined ? Math.max(0, safeFloat(body.boxMarginPercent, 0)) : undefined,
      },
      include: {
        category: true,
        brand: true,
        comboItems: { include: { product: { select: { id: true, name: true, barcode: true, price: true, stock: true } } } },
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 });
  }
}

// ===== AJUSTE MASIVO DE PRECIOS =====
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, categoryId, percentage, applyTo } = body;

    if (action !== 'bulk-price') {
      return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
    }

    const pct = safeFloat(percentage, NaN);
    if (isNaN(pct)) {
      return NextResponse.json({ error: 'Porcentaje invalido' }, { status: 400 });
    }

    const where: any = { active: true };
    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }

    const affected = await db.product.findMany({
      where,
      select: { id: true, name: true, price: true, cost: true, wholesalePrice: true, categoryId: true },
      orderBy: { name: 'asc' },
    });

    if (affected.length === 0) {
      return NextResponse.json({ error: 'No se encontraron productos con los filtros seleccionados' }, { status: 404 });
    }

    const applyToSale = applyTo === 'sale' || applyTo === 'both';
    const applyToCost = applyTo === 'cost' || applyTo === 'both';
    const applyToWholesale = applyTo === 'both';

    const updates = affected.map(p => {
      const data: any = {};
      if (applyToSale && p.price > 0) data.price = Math.round(p.price * (1 + pct / 100) * 10000) / 10000;
      if (applyToCost && p.cost > 0) data.cost = Math.round(p.cost * (1 + pct / 100) * 10000) / 10000;
      if (applyToWholesale && p.wholesalePrice > 0) data.wholesalePrice = Math.round(p.wholesalePrice * (1 + pct / 100) * 10000) / 10000;
      return { id: p.id, data };
    }).filter(u => Object.keys(u.data).length > 0);

    const result = await db.$transaction(
      updates.map(u => db.product.update({ where: { id: u.id }, data: u.data }))
    );

    return NextResponse.json({
      success: true,
      updatedCount: updates.length,
      totalAffected: affected.length,
      percentage: pct,
      applyTo,
      categoryId: categoryId || 'ALL',
      preview: affected.map(p => {
        const newPrice = applyToSale && p.price > 0 ? Math.round(p.price * (1 + pct / 100) * 10000) / 10000 : p.price;
        const newCost = applyToCost && p.cost > 0 ? Math.round(p.cost * (1 + pct / 100) * 10000) / 10000 : p.cost;
        return { name: p.name, oldPrice: p.price, newPrice, oldCost: p.cost, newCost };
      }),
    });
  } catch (error) {
    console.error('Error en ajuste masivo:', error);
    return NextResponse.json({ error: 'Error al aplicar ajuste masivo de precios' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await db.product.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar producto' }, { status: 500 });
  }
}
