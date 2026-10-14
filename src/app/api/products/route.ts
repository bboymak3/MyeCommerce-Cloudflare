export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { d1Of } from '@/lib/d1-read';
import { D1Batch, fromDbRow } from '@/lib/d1-batch';

function safeFloat(v: any, fallback: number = 0): number {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

/**
 * Productos del negocio con category, brand, comboItems y comboItemsRef, en el formato del
 * findMany de Prisma, leidos con SQL directo en un solo lote (ver "Limite de CPU" en CLAUDE.md).
 * `where` es SQL extra sobre pos_products con parametros desde ?2.
 */
async function loadProductsSql(D1: D1Database, tenantId: string, where: string, ...params: unknown[]) {
  const [prodRes, catRes, brandRes, comboRes] = await D1.batch([
    D1.prepare(`SELECT * FROM pos_products WHERE tenant_id = ?1 ${where} ORDER BY name ASC`).bind(tenantId, ...params),
    D1.prepare('SELECT * FROM pos_categories WHERE tenant_id = ?1').bind(tenantId),
    D1.prepare('SELECT * FROM pos_brands WHERE tenant_id = ?1').bind(tenantId),
    D1.prepare(`SELECT ci.*, p.id AS _pid, p.name AS _pname, p.barcode AS _pbarcode, p.price AS _pprice, p.stock AS _pstock,
        c.id AS _cid, c.name AS _cname
      FROM pos_combo_items ci
      LEFT JOIN pos_products p ON p.id = ci.productId
      LEFT JOIN pos_products c ON c.id = ci.comboId
      WHERE ci.tenant_id = ?1`).bind(tenantId),
  ]);
  const categories = new Map(((catRes.results || []) as any[]).map((r) => [r.id, fromDbRow('pos_categories', r)]));
  const brands = new Map(((brandRes.results || []) as any[]).map((r) => [r.id, fromDbRow('pos_brands', r)]));
  const byCombo = new Map<string, any[]>();
  const byProduct = new Map<string, any[]>();
  for (const r of (comboRes.results || []) as any[]) {
    const { _pid, _pname, _pbarcode, _pprice, _pstock, _cid, _cname, ...item } = r;
    const base = fromDbRow('pos_combo_items', item);
    if (!byCombo.has(r.comboId)) byCombo.set(r.comboId, []);
    byCombo.get(r.comboId)!.push({ ...base, product: _pid ? { id: _pid, name: _pname, barcode: _pbarcode, price: _pprice, stock: _pstock } : null });
    if (!byProduct.has(r.productId)) byProduct.set(r.productId, []);
    byProduct.get(r.productId)!.push({ ...base, combo: _cid ? { id: _cid, name: _cname } : null });
  }
  return ((prodRes.results || []) as any[]).map((r) => ({
    ...fromDbRow<any>('pos_products', r),
    category: (r.categoryId && categories.get(r.categoryId)) || null,
    brand: (r.brandId && brands.get(r.brandId)) || null,
    comboItems: byCombo.get(r.id) || [],
    comboItemsRef: byProduct.get(r.id) || [],
  }));
}

/** Un producto con category, brand y comboItems (lo que devolvia create/update de Prisma). */
async function loadProductSql(D1: D1Database, tenantId: string, id: string) {
  const [p] = await loadProductsSql(D1, tenantId, 'AND id = ?2', id);
  if (!p) return null;
  const { comboItemsRef: _ref, ...rest } = p;
  return rest;
}

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const products = await loadProductsSql(d1Of(env), tenantId, 'AND active = 1');
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const body = await req.json() as any;
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

    const D1 = d1Of(env);
    const batch = new D1Batch(D1, tenantId);
    const productId = batch.insert('pos_products', {
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
    });
    await batch.commit();
    const product = await loadProductSql(D1, tenantId, productId);
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const body = await req.json() as any;
    if (!body.id) return NextResponse.json({ error: 'ID del producto es requerido' }, { status: 400 });
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: 'Nombre del producto es requerido' }, { status: 400 });
    }
    const price = safeFloat(body.price, NaN);
    if (body.price !== undefined && (isNaN(price) || price < 0)) {
      return NextResponse.json({ error: 'Precio invalido' }, { status: 400 });
    }

    const D1 = d1Of(env);
    const exists = await D1.prepare('SELECT id FROM pos_products WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, String(body.id)).first();
    if (!exists) return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 });
    const batch = new D1Batch(D1, tenantId);
    batch.update('pos_products', String(body.id), {
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
    });
    await batch.commit();
    const product = await loadProductSql(D1, tenantId, String(body.id));
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 });
  }
}

// ===== AJUSTE MASIVO DE PRECIOS =====
export async function PATCH(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const body = await req.json() as any;
    const { action, categoryId, percentage, applyTo } = body;

    if (action !== 'bulk-price') {
      return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
    }

    const pct = safeFloat(percentage, NaN);
    if (isNaN(pct)) {
      return NextResponse.json({ error: 'Porcentaje invalido' }, { status: 400 });
    }

    const byCategory = categoryId && categoryId !== 'ALL';
    const { results: affectedRows } = await d1Of(env).prepare(
      `SELECT id, name, price, cost, wholesalePrice, categoryId FROM pos_products
       WHERE tenant_id = ?1 AND active = 1 ${byCategory ? 'AND categoryId = ?2' : ''} ORDER BY name ASC`,
    ).bind(tenantId, ...(byCategory ? [categoryId] : [])).all();
    const affected = (affectedRows || []) as { id: string; name: string; price: number; cost: number; wholesalePrice: number; categoryId: string | null }[];

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

    // Todos los precios en un lote atomico de D1: o se ajustan todos o ninguno
    const batch = new D1Batch((env as any).DB, tenantId);
    for (const u of updates) batch.update('pos_products', u.id, u.data);
    await batch.commit();

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
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const D1 = d1Of(env);
    const exists = await D1.prepare('SELECT id FROM pos_products WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, id).first();
    if (!exists) return NextResponse.json({ error: 'Error al eliminar producto' }, { status: 500 });
    const batch = new D1Batch(D1, tenantId);
    batch.update('pos_products', id, { active: false });
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar producto' }, { status: 500 });
  }
}
