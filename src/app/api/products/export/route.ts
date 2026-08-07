import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

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

    // Construir filas del Excel
    const rows = products.map((p, index) => {
      const margen = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0;
      const gananciaUnitaria = p.price - p.cost;
      const valorInventario = p.price * p.stock;
      const gananciaTotal = gananciaUnitaria * p.stock;

      return {
        '#': index + 1,
        'Nombre': p.name,
        'Codigo de barras': p.barcode || '',
        'Categoria': p.category?.name || '',
        'Precio Venta ($)': p.price,
        'Precio Compra ($)': p.cost,
        'Stock': p.stock,
        'Ganancia Unitaria ($)': Math.round(gananciaUnitaria * 100) / 100,
        'Margen (%)': Math.round(margen * 100) / 100,
        'Valor Inventario ($)': Math.round(valorInventario * 100) / 100,
        'Ganancia Potencial ($)': Math.round(gananciaTotal * 100) / 100,
        'Descripcion': p.description || '',
      };
    });

    // Fila de totales
    const totalValorInventario = products.reduce((sum, p) => sum + p.price * p.stock, 0);
    const totalGananciaPotencial = products.reduce((sum, p) => sum + (p.price - p.cost) * p.stock, 0);
    const totalCostoInventario = products.reduce((sum, p) => sum + p.cost * p.stock, 0);

    // Fila de totales (usamos any para columnas vacias que se mezclan con numeros)
    const totalRow: Record<string, any> = {
      '#': '',
      'Nombre': 'TOTALES',
      'Codigo de barras': '',
      'Categoria': `${products.length} productos`,
      'Stock': products.reduce((s, p) => s + p.stock, 0),
      'Valor Inventario ($)': Math.round(totalValorInventario * 100) / 100,
      'Ganancia Potencial ($)': Math.round(totalGananciaPotencial * 100) / 100,
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
      { wch: 18 },  // Codigo
      { wch: 18 },  // Categoria
      { wch: 16 },  // Precio venta
      { wch: 16 },  // Precio compra
      { wch: 8 },   // Stock
      { wch: 18 },  // Ganancia unit
      { wch: 10 },  // Margen
      { wch: 18 },  // Valor inv
      { wch: 18 },  // Ganancia pot
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