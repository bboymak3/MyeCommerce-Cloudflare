import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Mapeo de tipo IVA a porcentaje
const TAX_TYPE_LABELS: Record<string, string> = {
  exento: 'Exento (0%)',
  reducido: 'Reducido (8%)',
  general: 'General (16%)',
  omitido: 'Omitido (0%)',
};

export async function GET() {
  try {
    const products = await db.product.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) {
      return NextResponse.json({ error: 'No hay productos para exportar' }, { status: 400 });
    }

    // Construir filas del Excel con TODOS los campos
    const rows = products.map((p, index) => {
      const margen = p.cost > 0 ? ((p.price - p.cost) / p.cost * 100) : 0;
      const gananciaUnitaria = p.price - p.cost;
      const valorInventario = p.price * p.stock;
      const gananciaTotal = gananciaUnitaria * p.stock;
      const margenCaja = p.boxPrice && p.cost && p.unitsPerBox && p.unitsPerBox > 0
        ? ((p.boxPrice - (p.cost * p.unitsPerBox)) / (p.cost * p.unitsPerBox) * 100)
        : 0;
      const gananciaCaja = p.boxPrice && p.cost && p.unitsPerBox && p.unitsPerBox > 0
        ? p.boxPrice - (p.cost * p.unitsPerBox)
        : 0;

      return {
        '#': index + 1,
        'Nombre': p.name,
        'Codigo de barras': p.barcode || '',
        'Codigo secundario': p.secondaryBarcode || '',
        'Categoria': p.category?.name || '',
        'Precio Venta ($)': p.price,
        'Precio Compra ($)': p.cost,
        'Margen (%)': Math.round((p.marginPercent || margen) * 100) / 100,
        'Ganancia Unitaria ($)': Math.round(gananciaUnitaria * 100) / 100,
        'Tipo IVA': TAX_TYPE_LABELS[p.taxType || 'exento'] || p.taxType || 'Exento (0%)',
        'IVA (%)': p.taxType === 'general' ? 16 : p.taxType === 'reducido' ? 8 : 0,
        'Stock': p.stock,
        'Stock Minimo': p.minStock || 0,
        'Valor Inventario ($)': Math.round(valorInventario * 100) / 100,
        'Ganancia Potencial ($)': Math.round(gananciaTotal * 100) / 100,
        'Precio Mayoreo ($)': p.wholesalePrice || '',
        'Cantidad Min Mayoreo': p.minWholesaleQty || '',
        'Sin Stock (venta)': p.noStock ? 'SI' : 'NO',
        'Vende por Peso': p.vendePorPeso ? 'SI' : 'NO',
        'Unidad Peso': p.unidadPeso || '',
        'Ubicacion Almacen': p.location || '',
        'Fecha Vencimiento': p.expirationDate || '',
        'Lote': p.lotNumber || '',
        'Es Combo/Kit': p.isCombo ? 'SI' : 'NO',
        'Puntos Fidelidad': p.loyaltyPoints || 0,
        'Unidades por Caja': p.unitsPerBox || '',
        'Precio Caja ($)': p.boxPrice || '',
        'Margen Caja (%)': p.boxMarginPercent || '',
        'Ganancia Caja ($)': Math.round(gananciaCaja * 100) / 100,
        'Tiene Imagen': p.image ? 'SI' : 'NO',
        'Descripcion': p.description || '',
      };
    });

    // Fila de totales
    const totalValorInventario = products.reduce((sum, p) => sum + p.price * p.stock, 0);
    const totalGananciaPotencial = products.reduce((sum, p) => sum + (p.price - p.cost) * p.stock, 0);
    const totalCostoInventario = products.reduce((sum, p) => sum + p.cost * p.stock, 0);
    const totalStock = products.reduce((s, p) => s + p.stock, 0);

    const totalRow: Record<string, any> = {
      '#': '',
      'Nombre': 'TOTALES',
      'Codigo de barras': '',
      'Codigo secundario': '',
      'Categoria': `${products.length} productos`,
      'Precio Venta ($)': '',
      'Precio Compra ($)': '',
      'Margen (%)': '',
      'Ganancia Unitaria ($)': '',
      'Tipo IVA': '',
      'IVA (%)': '',
      'Stock': totalStock,
      'Stock Minimo': '',
      'Valor Inventario ($)': Math.round(totalValorInventario * 100) / 100,
      'Ganancia Potencial ($)': Math.round(totalGananciaPotencial * 100) / 100,
      'Precio Mayoreo ($)': '',
      'Cantidad Min Mayoreo': '',
      'Sin Stock (venta)': '',
      'Vende por Peso': '',
      'Unidad Peso': '',
      'Ubicacion Almacen': '',
      'Fecha Vencimiento': '',
      'Lote': '',
      'Es Combo/Kit': products.filter(p => p.isCombo).length + ' combos',
      'Puntos Fidelidad': '',
      'Unidades por Caja': '',
      'Precio Caja ($)': '',
      'Margen Caja (%)': '',
      'Ganancia Caja ($)': '',
      'Tiene Imagen': products.filter(p => p.image).length + ' con imagen',
      'Descripcion': `Costo total inversion: $${(Math.round(totalCostoInventario * 100) / 100).toFixed(2)}`,
    };
    rows.push(totalRow as any);

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Anchos de columna
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 35 },  // Nombre
      { wch: 18 },  // Codigo barras
      { wch: 18 },  // Codigo secundario
      { wch: 18 },  // Categoria
      { wch: 16 },  // Precio venta
      { wch: 16 },  // Precio compra
      { wch: 12 },  // Margen %
      { wch: 18 },  // Ganancia unit
      { wch: 18 },  // Tipo IVA
      { wch: 10 },  // IVA %
      { wch: 8 },   // Stock
      { wch: 12 },  // Stock minimo
      { wch: 18 },  // Valor inv
      { wch: 18 },  // Ganancia pot
      { wch: 16 },  // Precio mayoreo
      { wch: 16 },  // Cantidad min mayoreo
      { wch: 14 },  // Sin stock
      { wch: 14 },  // Vende por peso
      { wch: 12 },  // Unidad peso
      { wch: 20 },  // Ubicacion almacen
      { wch: 16 },  // Fecha vencimiento
      { wch: 16 },  // Lote
      { wch: 12 },  // Es combo
      { wch: 16 },  // Puntos fidelidad
      { wch: 16 },  // Unidades por caja
      { wch: 16 },  // Precio caja
      { wch: 14 },  // Margen caja %
      { wch: 16 },  // Ganancia caja
      { wch: 14 },  // Tiene imagen
      { wch: 30 },  // Descripcion
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Retornar como descarga
    const fecha = new Date().toISOString().split('T')[0];
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="inventario_${fecha}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Error al exportar: ' + (error.message || 'Error desconocido') }, { status: 500 });
  }
}
