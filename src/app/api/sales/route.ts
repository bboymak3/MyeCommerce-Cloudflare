export const runtime = 'edge';
import { createDbFromEnv, getTenantId } from '@/lib/db'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { d1Of, loadProductsWithLastMove } from '@/lib/d1-read';
import { D1Batch, sqlExpr, fromDbRow } from '@/lib/d1-batch';
import { veDayStart, veDayEnd } from '@/lib/ve-time';

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
      where: { ...(startDate && endDate ? { date: { gte: veDayStart(startDate), lte: veDayEnd(endDate) } } : {}) },
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
  const tenantId = getTenantId(req.headers);
  // Sin Prisma: lecturas y respuesta con SQL directo (ver "Limite de CPU" en CLAUDE.md)
  const D1 = d1Of(env);
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

    // Todas las lecturas en dos viajes: configuracion, turno y cliente; productos y su ultimo
    // movimiento de kardex
    const uId = req.headers.get('x-user-id') || String(body.userId || '');
    const [settingsRes, shiftRes, clientRes] = await D1.batch([
      D1.prepare('SELECT * FROM pos_settings WHERE tenant_id = ?1 LIMIT 1').bind(tenantId),
      D1.prepare(`SELECT id FROM pos_cash_shifts WHERE tenant_id = ?1 AND userId = ?2 AND status = 'open' LIMIT 1`).bind(tenantId, uId),
      D1.prepare('SELECT * FROM pos_clients WHERE tenant_id = ?1 AND id = ?2 LIMIT 1').bind(tenantId, String(body.clientId || '')),
    ]);
    const settings: any = fromDbRow('pos_settings', (settingsRes.results || [])[0] as any);
    const { products, lastMoves } = await loadProductsWithLastMove(D1, tenantId, body.items.map((i: any) => String(i.productId || '')));
    const allowZeroStock = settings?.allowZeroStock === true;
    const loyaltyEnabled = settings?.loyaltyEnabled === true;

    // Always validate quantity format and product existence
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: `Cantidad invalida para "${item.productName || item.productId}"` }, { status: 400 });
      }
      const product = products.get(item.productId);
      if (!product) return NextResponse.json({ error: `Producto no encontrado: ${item.productName || item.productId}` }, { status: 400 });
      // Only check stock level when zero-stock is NOT allowed
      if (!allowZeroStock && product.stock < qty) {
        return NextResponse.json({ error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, Solicitado: ${qty}`, code: 'INSUFFICIENT_STOCK', productName: product.name, availableStock: product.stock, requestedQuantity: qty }, { status: 400 });
      }
    }

    // Lecturas primero; despues todas las escrituras en un lote atomico de D1

    // 2. Read product costs and last inventory movements for kardex — READS FIRST
    // Vendedor: el nombre elegido en la pantalla o, si no viene, el usuario de la sesion.
    // El rol sale siempre de la sesion (el del cuerpo solo si no hay sesion).
    const sName = body.sellerName || req.headers.get('x-username') || '';
    const sRole = req.headers.get('x-user-role') || body.sellerRole || '';
    const openShift: any = uId ? (shiftRes.results || [])[0] || null : null;
    const kardexData: { productId: string; qty: number; unitCost: number; balQty: number; balTC: number; balAvg: number }[] = [];
    let pointsEarned = 0;
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      const product = products.get(item.productId);
      const unitCost = product?.cost || 0;
      const lastMove = lastMoves.get(item.productId);
      // Saldo anterior = stock real antes de descontar (el kardex siempre cuadra con el inventario)
      const prevQty = product?.stock ?? lastMove?.balanceQty ?? 0;
      const prevTC = lastMove?.balanceTotalCost ?? (prevQty * unitCost);
      const balQty = prevQty - qty;
      const balTC = Math.max(0, prevTC - (qty * unitCost));
      const balAvg = balQty > 0 ? balTC / balQty : 0;
      kardexData.push({ productId: item.productId, qty, unitCost, balQty, balTC, balAvg });
      pointsEarned += (product?.loyaltyPoints || 0) * qty;
    }
    pointsEarned = Math.round(pointsEarned);

    // 3. Read client (credit balance / loyalty points) if a client is attached — READ FIRST
    let clientCreditBalance: number | null = null;
    let clientLoyaltyPoints: number | null = null;
    let pointsRedeemed = 0;
    if (body.clientId) {
      const client: any = fromDbRow('pos_clients', (clientRes.results || [])[0] as any);
      if (client) {
        clientCreditBalance = Number(client.creditBalance || 0);
        clientLoyaltyPoints = Math.round(Number(client.loyaltyPoints || 0));
        if (loyaltyEnabled && !client.isFinalClient) {
          pointsRedeemed = Math.round(parseFloat(body.pointsRedeemed) || 0);
          if (pointsRedeemed < 0) pointsRedeemed = 0;
          if (pointsRedeemed > clientLoyaltyPoints) {
            return NextResponse.json({ error: `El cliente solo tiene ${clientLoyaltyPoints} puntos disponibles` }, { status: 400 });
          }
        } else {
          pointsEarned = 0;
        }
      } else {
        pointsEarned = 0;
      }
    } else {
      pointsEarned = 0;
    }
    if (!loyaltyEnabled) { pointsEarned = 0; pointsRedeemed = 0; }

    // 4. Escrituras: venta, items, stock, kardex y cliente en un solo lote atomico.
    // El numero de factura (correlativo de 8 digitos) lo calcula D1 dentro del lote:
    // los lotes se ejecutan uno tras otro, asi que dos cajas nunca reciben el mismo.
    const d1 = (env as any).DB as D1Database;
    const nextInvoice = sqlExpr(
      `SELECT printf('%08d', COALESCE(MAX(CAST("invoiceNumber" AS INTEGER)), 0) + 1) FROM "pos_sales" WHERE "tenant_id" = ?`,
      tenantId,
    );
    const batch = new D1Batch(d1, tenantId);
    const saleId = batch.insert('pos_sales', {
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
      sellerName: sName,
      sellerRole: sRole,
      notes: body.notes || '',
      clientId: body.clientId || null,
      isCredit: !!body.isCredit,
      creditPaid: body.isCredit ? 0 : undefined,
      creditDays: body.isCredit ? (parseInt(body.creditDays) || 30) : undefined,
      creditDueDate: body.isCredit ? (() => { const d = new Date(); d.setDate(d.getDate() + (parseInt(body.creditDays) || 30)); return d; })() : undefined,
      invoiceNumber: nextInvoice,
      shiftId: openShift?.id || null,
      pointsEarned,
      pointsRedeemed,
      createdAt: now,
    });

    for (const item of body.items) {
      batch.insert('pos_sale_items', {
        saleId,
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        total: parseFloat(item.total),
      });
      batch.update('pos_products', item.productId, { stock: { decrement: parseFloat(item.quantity) } });
    }

    // Kardex (venta = salida)
    for (const kd of kardexData) {
      batch.insert('pos_inventory_movements', {
        productId: kd.productId, date: now, movementType: 'venta',
        concept: sqlExpr(`SELECT 'Venta ' || "invoiceNumber" FROM "pos_sales" WHERE "id" = ?`, saleId),
        quantity: -kd.qty, absQuantity: kd.qty, unitCost: kd.unitCost, totalCost: kd.qty * kd.unitCost,
        balanceQty: kd.balQty, balanceTotalCost: kd.balTC, balanceAvgCost: kd.balAvg,
        userId: uId, userName: sName, userRole: sRole, referenceId: saleId,
      });
    }

    // Cliente: saldo de credito (si aplica) y puntos de fidelidad, calculados en la base
    if (body.clientId && (clientCreditBalance !== null || clientLoyaltyPoints !== null)) {
      if (body.isCredit && clientCreditBalance !== null) {
        batch.raw('UPDATE "pos_clients" SET "creditBalance" = ROUND("creditBalance" + ?, 2), "updatedAt" = ? WHERE "id" = ? AND "tenant_id" = ?', total, new Date(), body.clientId);
      }
      if (loyaltyEnabled && clientLoyaltyPoints !== null && (pointsEarned > 0 || pointsRedeemed > 0)) {
        batch.raw('UPDATE "pos_clients" SET "loyaltyPoints" = MAX(0, "loyaltyPoints" - ? + ?), "updatedAt" = ? WHERE "id" = ? AND "tenant_id" = ?', pointsRedeemed, pointsEarned, new Date(), body.clientId);
      }
    }

    await batch.commit();

    return NextResponse.json(await loadSaleSql(D1, tenantId, saleId));
  } catch (error: any) {
    console.error('Error creating sale:', error);
    return NextResponse.json({ error: `Error al registrar venta: ${error?.message || String(error)}` }, { status: 500 });
  }
}

/**
 * Venta con sus items (nombre y peso del producto), el cliente y la cantidad de abonos:
 * lo mismo que devolvia el findUnique de Prisma, leido con SQL directo.
 */
async function loadSaleSql(D1: D1Database, tenantId: string, saleId: string) {
  const [saleRes, itemsRes, payRes] = await D1.batch([
    D1.prepare('SELECT * FROM pos_sales WHERE tenant_id = ?1 AND id = ?2').bind(tenantId, saleId),
    D1.prepare(`SELECT si.*, p.id AS _pid, p.name AS _pname, p.vendePorPeso AS _pvpp, p.unidadPeso AS _pup
      FROM pos_sale_items si LEFT JOIN pos_products p ON p.id = si.productId
      WHERE si.tenant_id = ?1 AND si.saleId = ?2 ORDER BY si.rowid`).bind(tenantId, saleId),
    D1.prepare('SELECT COUNT(*) AS n FROM pos_credit_payments WHERE tenant_id = ?1 AND saleId = ?2').bind(tenantId, saleId),
  ]);
  const sale: any = fromDbRow('pos_sales', (saleRes.results || [])[0] as any);
  if (!sale) return null;
  let client = null;
  if (sale.clientId) {
    const c: any = await D1.prepare('SELECT id, fullName, docType, docNumber, creditBalance FROM pos_clients WHERE tenant_id = ?1 AND id = ?2')
      .bind(tenantId, sale.clientId).first();
    client = c ? { id: c.id, fullName: c.fullName, docType: c.docType, docNumber: c.docNumber, creditBalance: c.creditBalance } : null;
  }
  const items = ((itemsRes.results || []) as any[]).map(({ _pid, _pname, _pvpp, _pup, ...item }) => ({
    ...fromDbRow('pos_sale_items', item),
    product: _pid ? { name: _pname, vendePorPeso: _pvpp === 1 || _pvpp === true, unidadPeso: _pup } : null,
  }));
  return { ...sale, items, client, _count: { creditPayments: Number(((payRes.results || []) as any[])[0]?.n) || 0 } };
}
