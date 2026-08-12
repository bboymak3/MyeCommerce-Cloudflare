import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logInfo, logWarn } from '@/lib/logger';

const sf = (v: any, fb: number = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, oldStock, newStock, quantity, movementType, reason, unitCost } = body;

    if (!productId || !movementType || !reason || !reason.trim()) {
      return NextResponse.json({ error: 'Faltan datos requeridos (productId, movementType, reason)' }, { status: 400 });
    }

    if (!['ajuste_entrada', 'ajuste_salida'].includes(movementType)) {
      return NextResponse.json({ error: 'Tipo de movimiento no valido' }, { status: 400 });
    }

    const qty = Math.abs(sf(quantity, 0));
    if (qty <= 0) {
      return NextResponse.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 });
    }

    // Get user info from headers
    const userName = req.headers.get('x-user-name') || 'Sistema';
    const userRole = req.headers.get('x-user-role') || '';
    const userId = req.headers.get('x-user-id') || '';

    // Fetch product for current cost and last kardex balance
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const cost = sf(unitCost, product.cost);
    const totalCost = qty * cost;

    // Get last kardex balance
    const lastMove = await db.inventoryMovement.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });

    let prevQty: number, prevTC: number;
    if (lastMove) {
      prevQty = sf(lastMove.balanceQty, product.stock);
      prevTC = sf(lastMove.balanceTotalCost, prevQty * cost);
    } else {
      prevQty = sf(oldStock, product.stock);
      prevTC = prevQty * cost;
    }

    // Calculate new balance
    const signedQty = movementType === 'ajuste_entrada' ? qty : -qty;
    const balQty = Math.max(0, prevQty + signedQty);
    const balTC = movementType === 'ajuste_entrada' ? prevTC + totalCost : Math.max(0, prevTC - totalCost);
    const balAvg = balQty > 0 ? balTC / balQty : cost;

    // Create inventory movement
    const movement = await db.inventoryMovement.create({
      data: {
        productId,
        date: new Date(),
        movementType,
        concept: `Ajuste manual: ${reason.trim()}`,
        quantity: signedQty,
        absQuantity: qty,
        unitCost: cost,
        totalCost: movementType === 'ajuste_entrada' ? totalCost : -totalCost,
        balanceQty: balQty,
        balanceTotalCost: balTC,
        balanceAvgCost: balAvg,
        userId: String(userId),
        userName,
        userRole,
      },
    });

    // Log the adjustment
    logInfo('Kardex', `Ajuste de inventario registrado: ${product.name} | ${movementType === 'ajuste_entrada' ? '+' : '-'}${qty} uds | Motivo: ${reason.trim()}`, {
      productId,
      productName: product.name,
      oldStock: prevQty,
      newStock: balQty,
      quantity: qty,
      movementType,
      reason: reason.trim(),
      userName,
      userId,
    }, String(userId));

    logWarn('Kardex', `AJUSTE MANUAL DE INVENTARIO por ${userName}: "${product.name}" ${movementType === 'ajuste_entrada' ? '+' : '-'}${qty} uds — Motivo: "${reason.trim()}"`, {
      productId,
      productName: product.name,
      movementType,
      quantity: qty,
      reason: reason.trim(),
      userName,
    }, String(userId));

    return NextResponse.json({
      success: true,
      movement: {
        id: movement.id,
        productId,
        productName: product.name,
        movementType,
        quantity: signedQty,
        absQuantity: qty,
        balanceQty: balQty,
        concept: movement.concept,
        userName,
        date: movement.date,
      },
    });
  } catch (error: any) {
    console.error('Error creating inventory adjustment:', error);
    return NextResponse.json({ error: 'Error al registrar ajuste de inventario: ' + (error.message || '') }, { status: 500 });
  }
}
