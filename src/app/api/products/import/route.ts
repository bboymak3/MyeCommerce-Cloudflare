import { db } from '@/lib/db';
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

    // Pre-cargar categorias existentes
    const existingCategories = await db.category.findMany();
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase().trim(), c]));

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as { row: number; name: string; reason: string }[],
      categoriesCreated: [] as string[],
    };

    // Obtener licencia para verificar limite
    const license = await db.license.findFirst();
    const maxProducts = license?.maxProducts ?? 30;
    const currentCount = await db.product.count({ where: { active: true } });
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
          cat = await db.category.create({ data: { name: rawCategory.trim() } });
          categoryMap.set(catKey, cat);
          results.categoriesCreated.push(cat.name);
        }
        categoryId = cat.id;
      }

      // Buscar producto existente por codigo de barras o por nombre exacto
      let existing = null;
      if (rawBarcode) {
        existing = await db.product.findFirst({ where: { barcode: rawBarcode, active: true } });
      }
      if (!existing) {
        existing = await db.product.findFirst({ where: { name: rawName, active: true } });
      }

      if (existing) {
        // Actualizar producto existente
        await db.product.update({
          where: { id: existing.id },
          data: {
            name: rawName,
            description: rawDescription || existing.description,
            barcode: rawBarcode || existing.barcode,
            price: rawPrice,
            cost: isNaN(rawCost) ? existing.cost : rawCost,
            stock: isNaN(rawStock) ? existing.stock : rawStock,
            categoryId: categoryId !== null ? categoryId : existing.categoryId,
          },
        });
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
        await db.product.create({
          data: {
            name: rawName,
            description: rawDescription,
            barcode: rawBarcode,
            price: rawPrice,
            cost: isNaN(rawCost) ? 0 : rawCost,
            stock: isNaN(rawStock) ? 0 : rawStock,
            categoryId,
          },
        });
        results.created++;
      }
    }

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