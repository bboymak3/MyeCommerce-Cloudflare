import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const saleId = searchParams.get('id');
    // Fetch single sale by ID (for reprint)
    if (saleId) {
      const sale = await db.sale.findUnique({
        where: { id: saleId },
        include: { items: { include: { product: true } }, client: { select: { id: true, fullName: true, docType: true, docNumber: true, creditBalance: true } } },
      });
      if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
      return NextResponse.json(sale);
    }
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 1000);
    const sales = await db.sale.findMany({
      where: { ...(startDate && endDate ? { date: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') } } : {}) },
      include: { items: { include: { product: true } }, client: { select: { id: true, fullName: true, docType: true, docNumber: true, creditBalance: true } }, _count: { select: { creditPayments: true } } },
      orderBy: { date: 'desc' }, take: limit,
    });
    return NextResponse.json(sales);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener ventas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items de venta son requeridos' }, { status: 400 });
    }

    const subtotal = parseFloat(body.subtotal) || 0;
    const total = parseFloat(body.total);
    if (isNaN(total) || total <= 0) {
      return NextResponse.json({ error: 'Total de venta invalido' }, { status: 400 });
    }

    const discount = parseFloat(body.discount || 0);
    if (discount < 0) {
      return NextResponse.json({ error: 'Descuento no puede ser negativo' }, { status: 400 });
    }

    const settings = await db.settings.findFirst();
    const allowZeroStock = settings?.allowZeroStock === true;

    // Always validate quantity format and product existence
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: `Cantidad invalida para "${item.productName || item.productId}"` }, { status: 400 });
      }
      const product = await db.product.findUnique({ where: { id: item.productId } });
      if (!product) return NextResponse.json({ error: `Producto no encontrado: ${item.productName || item.productId}` }, { status: 400 });
      // Only check stock level when zero-stock is NOT allowed
      if (!allowZeroStock && product.stock < qty) {
        return NextResponse.json({ error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, Solicitado: ${qty}`, code: 'INSUFFICIENT_STOCK', productName: product.name, availableStock: product.stock, requestedQuantity: qty }, { status: 400 });
      }
    }

    // TRANSACTIONAL: create sale + update stock + update credit balance + invoice number
    const sale = await db.$transaction(async (tx) => {
      // Generate sequential invoice number (8-digit zero-padded)
      const lastSale = await tx.sale.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      });
      let nextNum = 1;
      if (lastSale && lastSale.invoiceNumber) {
        nextNum = parseInt(lastSale.invoiceNumber, 10) + 1;
      }
      const invoiceNumber = String(nextNum).padStart(8, '0');

      const newSale = await tx.sale.create({
        data: {
          date: now,
          subtotal,
          taxAmount: parseFloat(body.taxAmount || 0),
          discount,
          total,
          totalBs: parseFloat(body.totalBs),
          exchangeRate: parseFloat(body.exchangeRate),
          paymentMethod: body.paymentMethod || 'efectivo',
          referenceNumber: body.referenceNumber || '',
          mixedPaymentJson: body.mixedPaymentJson || '',
          customerName: body.customerName || '',
          clientDocType: body.clientDocType || '',
          clientDocNumber: body.clientDocNumber || '',
          clientName: body.clientName || '',
          clientAddress: body.clientAddress || '',
          sellerName: body.sellerName || '',
          sellerRole: body.sellerRole || '',
          notes: body.notes || '',
          clientId: body.clientId || null,
          isCredit: body.isCredit || false,
          creditPaid: body.isCredit ? 0 : undefined,
          creditDays: body.isCredit ? (parseInt(body.creditDays) || 30) : undefined,
          creditDueDate: body.isCredit ? (() => { const d = new Date(); d.setDate(d.getDate() + (parseInt(body.creditDays) || 30)); return d; })() : undefined,
          invoiceNumber,
          items: { create: body.items.map((item: any) => ({ productId: item.productId, quantity: parseFloat(item.quantity), unitPrice: parseFloat(item.unitPrice), total: parseFloat(item.total) })) },
        },
        include: { items: { include: { product: { select: { name: true, vendePorPeso: true, unidadPeso: true } } } }, client: { select: { id: true, fullName: true, docType: true, docNumber: true, creditBalance: true } }, _count: { select: { creditPayments: true } } },
      });

      // Decrement stock
      for (const item of body.items) {
        const qty = parseFloat(item.quantity);
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: qty } } });
      }

      // Register Kardex movements for each item (venta = salida)
      const sName = body.sellerName || '';
      const sRole = body.sellerRole || '';
      const uId = String(body.userId || '');
      for (const item of body.items) {
        const qty = parseFloat(item.quantity);
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const unitCost = product?.cost || 0;
        const lastMove = await tx.inventoryMovement.findFirst({ where: { productId: item.productId }, orderBy: { createdAt: 'desc' } });
        const prevQty = lastMove?.balanceQty ?? (product?.stock ?? 0) + qty;
        const prevTC = lastMove?.balanceTotalCost ?? (prevQty * unitCost);
        const balQty = prevQty - qty;
        const balTC = Math.max(0, prevTC - (qty * unitCost));
        const balAvg = balQty > 0 ? balTC / balQty : 0;
        await tx.inventoryMovement.create({
          data: { productId: item.productId, date: now, movementType: 'venta', concept: `Venta ${invoiceNumber}`, quantity: -qty, absQuantity: qty, unitCost, totalCost: qty * unitCost, balanceQty: balQty, balanceTotalCost: balTC, balanceAvgCost: balAvg, userId: uId, userName: sName, userRole: sRole, referenceId: newSale.id },
        });
      }

      // If credit sale, update client balance
      if (body.isCredit && body.clientId) {
        const client = await tx.client.findUnique({ where: { id: body.clientId } });
        if (client) {
          await tx.client.update({
            where: { id: body.clientId },
            data: { creditBalance: Number((Number(client.creditBalance || 0) + total).toFixed(2)) },
          });
        }
      }

      return newSale;
    });

    return NextResponse.json(sale);
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json({ error: 'Error al registrar venta' }, { status: 500 });
  }
}
