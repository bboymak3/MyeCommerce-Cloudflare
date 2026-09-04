export const runtime = 'edge';
import { createDbFromEnv, getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
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
  const { env } = getRequestContext();
  const tenantId = getTenantId(req.headers); const db = createDbFromEnv(env as any, tenantId);
  try {
    const body = await req.json() as any;
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

    // D1 BATCH TRANSACTION: all reads BEFORE transaction, then all writes as a batch

    // 1. Generate sequential invoice number (8-digit zero-padded) — READ FIRST
    const lastSale = await db.sale.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    let nextNum = 1;
    if (lastSale && lastSale.invoiceNumber) {
      nextNum = parseInt(lastSale.invoiceNumber, 10) + 1;
    }
    const invoiceNumber = String(nextNum).padStart(8, '0');

    // 2. Read product costs and last inventory movements for kardex — READS FIRST
    const sName = body.sellerName || '';
    const sRole = body.sellerRole || '';
    const uId = String(body.userId || '');
    const kardexData: { productId: string; qty: number; unitCost: number; balQty: number; balTC: number; balAvg: number }[] = [];
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      const product = await db.product.findUnique({ where: { id: item.productId } });
      const unitCost = product?.cost || 0;
      const lastMove = await db.inventoryMovement.findFirst({ where: { productId: item.productId }, orderBy: { createdAt: 'desc' } });
      const prevQty = lastMove?.balanceQty ?? (product?.stock ?? 0) + qty;
      const prevTC = lastMove?.balanceTotalCost ?? (prevQty * unitCost);
      const balQty = prevQty - qty;
      const balTC = Math.max(0, prevTC - (qty * unitCost));
      const balAvg = balQty > 0 ? balTC / balQty : 0;
      kardexData.push({ productId: item.productId, qty, unitCost, balQty, balTC, balAvg });
    }

    // 3. Read client credit balance if credit sale — READ FIRST
    let clientCreditBalance: number | null = null;
    if (body.isCredit && body.clientId) {
      const client = await db.client.findUnique({ where: { id: body.clientId } });
      if (client) {
        clientCreditBalance = Number(client.creditBalance || 0);
      }
    }

    // 4. Build batch write operations
    const ops: any[] = [];

    // Create sale (op index 0)
    ops.push(db.sale.create({
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
    }));

    // Decrement stock for each item
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      ops.push(db.product.update({ where: { id: item.productId }, data: { stock: { decrement: qty } } }));
    }

    // Create Kardex movements for each item (venta = salida)
    // Note: referenceId set to '' because sale ID is not available in batch mode
    for (const kd of kardexData) {
      ops.push(db.inventoryMovement.create({
        data: { productId: kd.productId, date: now, movementType: 'venta', concept: `Venta ${invoiceNumber}`, quantity: -kd.qty, absQuantity: kd.qty, unitCost: kd.unitCost, totalCost: kd.qty * kd.unitCost, balanceQty: kd.balQty, balanceTotalCost: kd.balTC, balanceAvgCost: kd.balAvg, userId: uId, userName: sName, userRole: sRole, referenceId: '' },
      }));
    }

    // If credit sale, update client balance
    if (body.isCredit && body.clientId && clientCreditBalance !== null) {
      ops.push(db.client.update({
        where: { id: body.clientId },
        data: { creditBalance: Number((clientCreditBalance + total).toFixed(2)) },
      }));
    }

    // Execute batch transaction
    const results = await db.$transaction(ops);
    const sale = results[0];

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error('Error creating sale:', error);
    return NextResponse.json({ error: `Error al registrar venta: ${error?.message || String(error)}` }, { status: 500 });
  }
}
