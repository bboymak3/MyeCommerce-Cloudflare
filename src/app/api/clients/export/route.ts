import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'xlsx'; // xlsx or csv or vcard
    const groupId = searchParams.get('groupId') || '';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const whereClause: any = {};
    if (!includeInactive) whereClause.isActive = true;

    const clients = await db.client.findMany({
      where: whereClause,
      orderBy: [{ fullName: 'asc' }],
      select: {
        id: true,
        type: true,
        docType: true,
        docNumber: true,
        fullName: true,
        phone: true,
        email: true,
        address: true,
        isFinalClient: true,
        createdAt: true,
        creditBalance: true,
        creditLimit: true,
      },
    });

    // Filter by group if specified
    const filtered = groupId
      ? clients.filter(c => c.id === groupId) // group filter (future: tags)
      : clients;

    if (format === 'vcard') {
      // Generate vCard format for phone contacts
      const vCards = filtered.map(c => {
        const nameParts = c.fullName.split(' ');
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        const firstName = nameParts[0] || '';
        return `BEGIN:VCARD
VERSION:3.0
N:${lastName};${firstName};;;
FN:${c.fullName}
TEL;TYPE=CELL:${c.phone || ''}
ADR;TYPE=HOME:;;${c.address || ''};;;;${c.fullName}
EMAIL:${c.email || ''}
NOTE:Cliente de ${c.docType} ${c.docNumber}
END:VCARD`;
      }).join('\n');

      return new NextResponse(vCards, {
        headers: {
          'Content-Type': 'text/vcard',
          'Content-Disposition': 'attachment; filename="contactos-clientes.vcf"',
        },
      });
    }

    // Excel/CSV export
    const data = filtered.map(c => ({
      'Nombre Completo': c.fullName,
      'Tipo Documento': c.docType === 'V' ? 'Venezolano' : c.docType === 'E' ? 'Extranjero' : c.docType === 'J' ? 'Juridico' : c.docType === 'P' ? 'Pasaporte' : c.docType,
      'Documento/RIF': `${c.docType}-${c.docNumber}`,
      'Telefono': c.phone || '',
      'Email': c.email || '',
      'Direccion': c.address || '',
      'Tipo': c.isFinalClient ? 'Consumidor Final' : 'Cliente Registrado',
      'Credito Disponible': c.creditLimit ? (c.creditLimit - (c.creditBalance || 0)).toFixed(2) : 'N/A',
      'Saldo Deuda': c.creditBalance ? c.creditBalance.toFixed(2) : '0.00',
      'Fecha Registro': c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-VE') : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = [
      { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 25 },
      { wch: 35 }, { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 15 },
    ];
    ws['!cols'] = colWidths;

    // Add a summary sheet
    const summaryData = [
      { 'Metrica': 'Total Clientes', 'Valor': filtered.length },
      { 'Metrica': 'Con Telefono', 'Valor': filtered.filter(c => c.phone).length },
      { 'Metrica': 'Con Email', 'Valor': filtered.filter(c => c.email).length },
      { 'Metrica': 'Con Direccion', 'Valor': filtered.filter(c => c.address).length },
      { 'Metrica': 'Con Credito', 'Valor': filtered.filter(c => c.creditLimit && c.creditLimit > 0).length },
      { 'Metrica': 'Deuda Total', 'Valor': filtered.reduce((sum, c) => sum + (c.creditBalance || 0), 0).toFixed(2) },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    ws2['!cols'] = [{ wch: 20 }, { wch: 15 }];

    // WhatsApp numbers sheet (just phone numbers for bulk messaging)
    const waData = filtered.filter(c => c.phone).map(c => ({
      'Nombre': c.fullName,
      'Telefono': c.phone,
      'Mensaje WhatsApp': `https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`,
    }));
    const ws3 = XLSX.utils.json_to_sheet(waData);
    ws3['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 50 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
    XLSX.utils.book_append_sheet(wb, ws3, 'WhatsApp');

    const buffer = XLSX.write(wb, { bookType: format === 'csv' ? 'csv' : 'xlsx', type: 'buffer' });

    const contentType = format === 'csv'
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = format === 'csv' ? '.csv' : '.xlsx';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="clientes-export${ext}"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Error al exportar clientes: ' + (error.message || '') }, { status: 500 });
  }
}
