import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59');
    }

    const sales = await db.sale.findMany({
      where,
      include: { items: { include: { product: { select: { name: true, barcode: true } } } }, client: { select: { fullName: true, docNumber: true } } },
      orderBy: { date: 'desc' },
    });

    if (format === 'json') {
      return NextResponse.json({ sales, count: sales.length });
    }

    // CSV format
    const lines: string[] = [];
    lines.push('Factura,Fecha,Cliente,Documento,Subtotal,IVA,Descuento,Total USD,Total Bs,Metodo Pago,Referencia,Vendedor,Notas');
    for (const s of sales) {
      lines.push([
        s.invoiceNumber,
        s.date.toISOString().slice(0, 10) + ' ' + s.date.toISOString().slice(11, 19),
        `"${(s.clientName || s.customerName || 'Cliente Final').replace(/"/g, '""')}"`,
        `"${(s.clientDocNumber || '').replace(/"/g, '""')}"`,
        s.subtotal.toFixed(2),
        s.taxAmount.toFixed(2),
        s.discount.toFixed(2),
        s.total.toFixed(2),
        s.totalBs.toFixed(2),
        s.paymentMethod,
        s.referenceNumber,
        `"${s.sellerName.replace(/"/g, '""')}"`,
        `"${s.notes.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      ].join(','));
    }

    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reporte-ventas-${startDate || 'todos'}-${endDate || 'todos'}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
