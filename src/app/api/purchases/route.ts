import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const supplierId = searchParams.get('supplierId');

    const purchases = await db.purchase.findMany({
      where: {
        ...(startDate && endDate ? { date: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') } } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        items: true,
        supplier: { select: { id: true, name: true, rif: true } },
      },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(purchases);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener compras' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items de compra son requeridos' }, { status: 400 });
    }
    const settings = await db.settings.findFirst();
    const exchangeRate = parseFloat(body.exchangeRate) || settings?.bcvRate || 36.5;

    // Calculate total from items
    const itemsTotal = body.items.reduce((sum: number, item: any) => {
      if (item.isBox) {
        // Compra por bulto: total = boxQty * boxCost
        return sum + (parseFloat(item.boxQty || 0) * parseFloat(item.boxCost || 0));
      }
      return sum + (parseFloat(item.unitCost || 0) * parseFloat(item.quantity || 0));
    }, 0);

    // TRANSACTIONAL: create purchase + update stock
    const purchase = await db.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          date: body.date ? new Date(body.date) : new Date(),
          number: body.number || '',
          supplierId: body.supplierId || null,
          totalUsd: parseFloat(itemsTotal.toFixed(2)),
          totalBs: parseFloat((itemsTotal * exchangeRate).toFixed(2)),
          exchangeRate,
          notes: body.notes || '',
          items: {
            create: body.items.map((item: any) => {
              if (item.isBox) {
                // Compra por bulto
                const boxQty = parseFloat(item.boxQty || 0);
                const unitsPerBox = parseFloat(item.unitsPerBox || 0);
                const boxCost = parseFloat(item.boxCost || 0);
                const totalUnits = boxQty * unitsPerBox;
                const calcUnitCost = unitsPerBox > 0 ? boxCost / unitsPerBox : 0;
                const calcMargin = parseFloat(item.calcMargin || 0);
                const calcPrice = calcUnitCost > 0 && calcMargin > 0
                  ? calcUnitCost / (1 - calcMargin / 100)
                  : 0;

                return {
                  productId: item.productId,
                  productName: item.productName || '',
                  quantity: totalUnits,
                  unitCost: parseFloat(calcUnitCost.toFixed(4)),
                  total: parseFloat((boxQty * boxCost).toFixed(2)),
                  isBox: true,
                  unitsPerBox,
                  boxQty,
                  boxCost,
                  calcUnitCost: parseFloat(calcUnitCost.toFixed(4)),
                  calcMargin,
                  calcPrice: parseFloat(calcPrice.toFixed(2)),
                };
              }
              // Compra por unidad (normal)
              const qty = parseFloat(item.quantity || 0);
              const cost = parseFloat(item.unitCost || 0);
              return {
                productId: item.productId,
                productName: item.productName || '',
                quantity: qty,
                unitCost: cost,
                total: parseFloat((qty * cost).toFixed(2)),
                isBox: false,
              };
            }),
          },
        },
        include: { items: true, supplier: true },
      });

      // Auto-update product stock, cost, and optionally price
      for (const item of body.items) {
        if (item.productId) {
          if (item.isBox) {
            const boxQty = parseFloat(item.boxQty || 0);
            const unitsPerBox = parseFloat(item.unitsPerBox || 0);
            const boxCost = parseFloat(item.boxCost || 0);
            const totalUnits = boxQty * unitsPerBox;
            const calcUnitCost = unitsPerBox > 0 ? boxCost / unitsPerBox : 0;
            const calcMargin = parseFloat(item.calcMargin || 0);
            const calcPrice = calcUnitCost > 0 && calcMargin >= 0
              ? calcUnitCost * (1 + calcMargin / 100) : 0;

            const updateData: any = {
              stock: { increment: totalUnits },
              cost: parseFloat(calcUnitCost.toFixed(4)),
            };
            // Si se calculo precio de venta, actualizarlo tambien
            if (calcPrice > 0) {
              updateData.price = parseFloat(calcPrice.toFixed(2));
              updateData.marginPercent = calcMargin;
            }
            // Actualizar unidades por caja si el producto tiene ese campo
            if (unitsPerBox > 0) {
              updateData.unitsPerBox = unitsPerBox;
              updateData.boxPrice = boxCost;
            }

            await tx.product.update({
              where: { id: item.productId },
              data: updateData,
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: { increment: parseFloat(item.quantity || 0) },
                ...(item.unitCost ? { cost: parseFloat(item.unitCost) } : {}),
              },
            });
          }
        }
      }

      // Register Kardex movements for each item (compra = entrada)
      const pDate = body.date ? new Date(body.date) : new Date();
      const pUser = req.headers.get('x-user-name') || '';
      const pRole = req.headers.get('x-user-role') || '';
      const pUserId = req.headers.get('x-user-id') || '';
      for (const item of body.items) {
        if (!item.productId) continue;
        const qty = item.isBox ? (parseFloat(item.boxQty || 0) * parseFloat(item.unitsPerBox || 0)) : parseFloat(item.quantity || 0);
        if (qty <= 0) continue;
        const unitCost = item.isBox ? parseFloat(item.calcUnitCost || 0) : parseFloat(item.unitCost || 0);
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const lastMove = await tx.inventoryMovement.findFirst({ where: { productId: item.productId }, orderBy: { createdAt: 'desc' } });
        const prevQty = lastMove?.balanceQty ?? (product?.stock ?? 0) - qty;
        const prevTC = lastMove?.balanceTotalCost ?? (prevQty * (product?.cost || unitCost));
        const entryTotalCost = qty * unitCost;
        const balQty = prevQty + qty;
        const balTC = prevTC + entryTotalCost;
        const balAvg = balQty > 0 ? balTC / balQty : unitCost;
        await tx.inventoryMovement.create({
          data: { productId: item.productId, date: pDate, movementType: 'compra', concept: `Compra ${newPurchase.number || ''}`, quantity: qty, absQuantity: qty, unitCost, totalCost: entryTotalCost, balanceQty: balQty, balanceTotalCost: balTC, balanceAvgCost: balAvg, userId: String(pUserId), userName: pUser, userRole: pRole, referenceId: newPurchase.id },
        });
      }

      return newPurchase;
    });

    return NextResponse.json(purchase);
  } catch (error: any) {
    console.error('Error creating purchase:', error);
    return NextResponse.json({ error: 'Error al registrar compra: ' + (error.message || '') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await db.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
      if (purchase) {
        for (const item of purchase.items) {
          if (item.productId) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (product && product.stock >= item.quantity) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } },
              });
            }
          }
        }
        await tx.purchase.delete({ where: { id } });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar compra' }, { status: 500 });
  }
}
