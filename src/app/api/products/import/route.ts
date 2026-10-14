export const runtime = 'edge';
import { getTenantId } from '@/lib/db'
import { D1Batch, fromDbRow } from '@/lib/d1-batch';
import { d1Of } from '@/lib/d1-read';
import { getNexusTenant, planToLicenseType } from '@/lib/nexus-tenant';
import { getLicenseLimits } from '@/lib/license';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Columnas esperadas en el Excel
const COL_NOMBRE = 'nombre';
const COL_CODIGO = 'codigo de barras';
const COL_CATEGORIA = 'categoria';
const COL_PRECIO_VENTA = 'precio venta ($)';
const COL_PRECIO_COMPRA = 'precio compra ($)';
const COL_STOCK = 'stock';
const COL_DESCRIPCION = 'descripcion';

// Mapeo flexible: acepta variantes de nombres de columna
const COL_MAP: Record<string, string[]> = {
  [COL_NOMBRE]: ['nombre', 'producto', 'name', 'descripcion_corta', 'nombre del producto', 'nombre producto'],
  [COL_CODIGO]: ['codigo de barras', 'codigo', 'barcode', 'codigobarras', 'codigo_barras', 'cod barra'],
  [COL_CATEGORIA]: ['categoria', 'categoría', 'category', 'rubro', 'linea', 'familia'],
  [COL_PRECIO_VENTA]: ['precio venta ($)', 'precio venta', 'precio de venta', 'precioventa', 'pvp', 'precio', 'price', 'precio de venta ($)'],
  [COL_PRECIO_COMPRA]: ['precio compra ($)', 'precio compra', 'precio de compra', 'preciocompra', 'costo', 'cost', 'precio de compra ($)'],
  [COL_STOCK]: ['stock', 'cantidad', 'existencia', 'inventario', 'qty', 'quantity'],
  [COL_DESCRIPCION]: ['descripcion', 'descripción', 'description', 'detalle'],
};

function normalizeHeader(header: string): string {
  return header.toString().toLowerCase().trim().replace(/[_\-\s]+/g, ' ');
}

function findColumnKey(headers: string[], targetAliases: string[]): string | null {
  for (const alias of targetAliases) {
    const found = headers.find(h => normalizeHeader(h) === alias);
    if (found) return found;
  }
  return null;
}

function buildColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, aliases] of Object.entries(COL_MAP)) {
    const found = findColumnKey(headers, aliases);
    if (found) map[key] = found;
  }
  return map;
}

export async function POST(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers);
  const D1 = d1Of(env);
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibio ningun archivo' }, { status: 400 });
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Formato no valido. Use .xlsx, .xls o .csv' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'El archivo esta vacio' }, { status: 400 });
    }

    // Obtener cabeceras y mapear columnas
    const headers = Object.keys(rows[0]);
    const colMap = buildColumnMap(headers);

    // Validar columnas obligatorias
    if (!colMap[COL_NOMBRE]) {
      return NextResponse.json({
        error: 'Falta la columna "Nombre". Columnas requeridas: Nombre, Precio Venta ($)',
        hint: 'Columnas aceptadas: ' + Object.keys(COL_MAP).join(', '),
        detectedColumns: headers,
      }, { status: 400 });
    }
    if (!colMap[COL_PRECIO_VENTA]) {
      return NextResponse.json({
        error: 'Falta la columna "Precio Venta ($)". Columnas requeridas: Nombre, Precio Venta ($)',
        hint: 'Columnas aceptadas: ' + Object.keys(COL_MAP).join(', '),
        detectedColumns: headers,
      }, { status: 400 });
    }

    // Sin Prisma (ver "Limite de CPU" en CLAUDE.md): todo se lee una vez, se decide en memoria
    // y se escribe en lotes. Antes eran 2 o 3 consultas por cada fila del archivo.
    const [catRes, prodRes, licRes] = await D1.batch([
      D1.prepare('SELECT * FROM pos_categories WHERE tenant_id = ?1').bind(tenantId),
      D1.prepare('SELECT id, name, description, barcode, cost, stock, categoryId FROM pos_products WHERE tenant_id = ?1 AND active = 1 ORDER BY rowid').bind(tenantId),
      D1.prepare('SELECT maxProducts FROM pos_licenses WHERE tenant_id = ?1 LIMIT 1').bind(tenantId),
    ]);
    // Pre-cargar categorias existentes
    const existingCategories = ((catRes.results || []) as any[]).map((r) => fromDbRow<any>('pos_categories', r));
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase().trim(), c]));
    // Productos activos por codigo y por nombre (el primero, como el findFirst de Prisma)
    const byBarcode = new Map<string, any>();
    const byName = new Map<string, any>();
    const remember = (prod: any) => {
      if (prod.barcode && !byBarcode.has(prod.barcode)) byBarcode.set(prod.barcode, prod);
      if (!byName.has(prod.name)) byName.set(prod.name, prod);
    };
    for (const prod of (prodRes.results || []) as any[]) remember(prod);
    // Escrituras en lotes de D1 (en orden: una categoria nueva se inserta antes que sus productos)
    let batch = new D1Batch(D1, tenantId);
    const flushIfFull = async () => { if (batch.size >= 100) { await batch.commit(); batch = new D1Batch(D1, tenantId); } };

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as { row: number; name: string; reason: string }[],
      categoriesCreated: [] as string[],
    };

    // Obtener licencia para verificar limite
    const nexus = await getNexusTenant((env as any).DB, tenantId, (env as any).LEGACY_TENANT_SLUG);
    const license: any = nexus ? null : (licRes.results || [])[0] || null;
    const maxProducts = nexus
      ? getLicenseLimits(planToLicenseType(nexus.plan)).maxProducts
      : license?.maxProducts ?? 30;
    const currentCount = ((prodRes.results || []) as any[]).length;
    const availableSlots = maxProducts - currentCount;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 porque fila 1 es cabecera, filas empiezan en 2

      const rawName = String(row[colMap[COL_NOMBRE]] || '').trim();
      if (!rawName) {
        results.skipped++;
        continue;
      }

      const rawPrice = parseFloat(String(row[colMap[COL_PRECIO_VENTA]] || '0'));
      if (isNaN(rawPrice) || rawPrice < 0) {
        results.errors.push({ row: rowNum, name: rawName, reason: 'Precio de venta invalido' });
        continue;
      }

      const rawBarcode = colMap[COL_CODIGO] ? String(row[colMap[COL_CODIGO]] || '').trim() : '';
      const rawCategory = colMap[COL_CATEGORIA] ? String(row[colMap[COL_CATEGORIA]] || '').trim() : '';
      const rawCost = colMap[COL_PRECIO_COMPRA] ? parseFloat(String(row[colMap[COL_PRECIO_COMPRA]] || '0')) : 0;
      const rawStock = colMap[COL_STOCK] ? parseInt(String(row[colMap[COL_STOCK]] || '0')) : 0;
      const rawDescription = colMap[COL_DESCRIPCION] ? String(row[colMap[COL_DESCRIPCION]] || '').trim() : '';

      // Resolver categoria
      let categoryId: string | null = null;
      if (rawCategory) {
        const catKey = rawCategory.toLowerCase().trim();
        let cat = categoryMap.get(catKey);
        if (!cat) {
          // Crear categoria nueva
          cat = { id: batch.insert('pos_categories', { name: rawCategory.trim(), icon: '', color: '#6366f1', active: true }), name: rawCategory.trim() };
          await flushIfFull();
          categoryMap.set(catKey, cat);
          results.categoriesCreated.push(cat.name);
        }
        categoryId = cat.id;
      }

      // Buscar producto existente por codigo de barras o por nombre exacto
      let existing: any = null;
      if (rawBarcode) {
        existing = byBarcode.get(rawBarcode) || null;
      }
      if (!existing) {
        existing = byName.get(rawName) || null;
      }

      if (existing) {
        // Actualizar producto existente
        const data = {
          name: rawName,
          description: rawDescription || existing.description,
          barcode: rawBarcode || existing.barcode,
          price: rawPrice,
          cost: isNaN(rawCost) ? existing.cost : rawCost,
          stock: isNaN(rawStock) ? existing.stock : rawStock,
          categoryId: categoryId !== null ? categoryId : existing.categoryId,
        };
        batch.update('pos_products', existing.id, data);
        await flushIfFull();
        // Si el archivo repite el producto, la siguiente fila parte de estos valores
        Object.assign(existing, data);
        remember(existing);
        results.updated++;
      } else {
        // Verificar limite de productos
        if (results.created >= availableSlots) {
          results.errors.push({
            row: rowNum,
            name: rawName,
            reason: `Limite de productos alcanzado (${maxProducts}). Faltaron productos por importar.`,
          });
          // Seguimos contando errores pero no paramos del todo
          continue;
        }

        // Crear producto nuevo
        const created = {
          name: rawName,
          description: rawDescription,
          barcode: rawBarcode,
          price: rawPrice,
          cost: isNaN(rawCost) ? 0 : rawCost,
          stock: isNaN(rawStock) ? 0 : rawStock,
          categoryId,
        };
        const id = batch.insert('pos_products', created);
        await flushIfFull();
        remember({ id, ...created });
        results.created++;
      }
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Importacion completada`,
      ...results,
      totalProcessed: rows.length,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Error al procesar el archivo: ' + (error.message || 'Error desconocido') }, { status: 500 });
  }
}