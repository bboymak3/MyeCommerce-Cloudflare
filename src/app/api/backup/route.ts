import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getAppVersion } from '@/lib/version';

export async function GET() {
  try {
    const [
      products, categories, brands, sales, settings,
      devolutions, cashClosings, license, users, clients,
      suppliers, purchases, creditPayments, roleConfigs,
      heldSales, quotes, deliveryNotes, inventoryMovements,
      expenseCategories, expenses,
    ] = await Promise.all([
      db.product.findMany(),
      db.category.findMany(),
      db.brand.findMany(),
      db.sale.findMany({ include: { items: true } }),
      db.settings.findFirst(),
      db.devolution.findMany({ include: { items: true } }),
      db.cashClosing.findMany(),
      db.license.findFirst(),
      db.user.findMany({ select: { id: true, username: true, fullName: true, role: true, isActive: true, permissions: true, avatar: true, lastLogin: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'asc' } }),
      db.client.findMany(),
      db.supplier.findMany(),
      db.purchase.findMany({ include: { items: true } }),
      db.creditPayment.findMany(),
      db.roleConfig.findMany(),
      db.heldSale.findMany({ include: { items: true } }),
      db.quote.findMany({ include: { items: true } }),
      db.deliveryNote.findMany({ include: { items: true } }),
      db.inventoryMovement.findMany(),
      db.expenseCategory.findMany(),
      db.expense.findMany(),
    ]);

    return NextResponse.json({
      version: getAppVersion(),
      exportedAt: new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
      products,
      categories,
      brands,
      clients,
      users,
      sales,
      devolutions,
      cashClosings,
      settings,
      license,
      suppliers,
      purchases,
      creditPayments,
      roleConfigs,
      heldSales,
      quotes,
      deliveryNotes,
      inventoryMovements,
      expenseCategories,
      expenses,
    });
  } catch (error) {
    console.error('Error al exportar datos:', error);
    return NextResponse.json({ error: 'Error al exportar datos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Limpiar BD existente (orden: dependencias primero)
    // Tablas con relaciones foreign key primero
    await db.deliveryNoteItem.deleteMany();
    await db.deliveryNote.deleteMany();
    await db.quoteItem.deleteMany();
    await db.quote.deleteMany();
    await db.heldSaleItem.deleteMany();
    await db.heldSale.deleteMany();
    await db.creditPayment.deleteMany();
    await db.inventoryMovement.deleteMany();
    await db.comboItem.deleteMany();
    await db.purchaseItem.deleteMany();
    await db.purchase.deleteMany();
    await db.expense.deleteMany();
    await db.expenseCategory.deleteMany();
    await db.devolutionItem.deleteMany();
    await db.devolution.deleteMany();
    await db.cashClosing.deleteMany();
    await db.saleItem.deleteMany();
    await db.sale.deleteMany();
    await db.product.deleteMany();
    await db.category.deleteMany();
    await db.brand.deleteMany();
    await db.supplier.deleteMany();
    await db.roleConfig.deleteMany();
    await db.settings.deleteMany();
    await db.license.deleteMany();
    await db.user.deleteMany();
    await db.client.deleteMany();

    // Restaurar en orden correcto (sin dependencias primero)
    if (data.roleConfigs?.length) {
      await db.roleConfig.createMany({ data: data.roleConfigs });
    }

    if (data.suppliers?.length) {
      await db.supplier.createMany({ data: data.suppliers });
    }

    if (data.expenseCategories?.length) {
      await db.expenseCategory.createMany({ data: data.expenseCategories });
    }

    // Restaurar usuarios (incluyendo admin)
    if (data.users?.length) {
      await db.user.createMany({ data: data.users });
    }

    // Restaurar clientes
    if (data.clients?.length) {
      await db.client.createMany({ data: data.clients });
    }

    // Restaurar categorias y marcas
    if (data.categories?.length) {
      await db.category.createMany({ data: data.categories });
    }

    if (data.brands?.length) {
      await db.brand.createMany({ data: data.brands });
    }

    // Restaurar productos
    if (data.products?.length) {
      await db.product.createMany({ data: data.products });
    }

    // Restaurar combo items
    if (data.comboItems?.length) {
      await db.comboItem.createMany({ data: data.comboItems });
    }

    // Restaurar ventas (con items)
    if (data.sales?.length) {
      for (const sale of data.sales) {
        const { items, ...saleData } = sale;
        await db.sale.create({
          data: {
            ...saleData,
            date: new Date(saleData.date),
            createdAt: new Date(saleData.createdAt),
            items: { create: items },
          },
        });
      }
    }

    // Restaurar devoluciones (con items)
    if (data.devolutions?.length) {
      for (const dev of data.devolutions) {
        const { items, ...devData } = dev;
        await db.devolution.create({
          data: {
            ...devData,
            date: new Date(devData.date),
            createdAt: new Date(devData.createdAt),
            items: { create: items },
          },
        });
      }
    }

    // Restaurar cierres de caja
    if (data.cashClosings?.length) {
      await db.cashClosing.createMany({
        data: data.cashClosings.map((c: any) => ({
          ...c,
          date: new Date(c.date),
          createdAt: new Date(c.createdAt),
        })),
      });
    }

    // Restaurar compras (con items)
    if (data.purchases?.length) {
      for (const purchase of data.purchases) {
        const { items, ...purchaseData } = purchase;
        await db.purchase.create({
          data: {
            ...purchaseData,
            date: new Date(purchaseData.date),
            createdAt: new Date(purchaseData.createdAt),
            updatedAt: new Date(purchaseData.updatedAt),
            items: { create: items },
          },
        });
      }
    }

    // Restaurar pagos de credito
    if (data.creditPayments?.length) {
      await db.creditPayment.createMany({
        data: data.creditPayments.map((cp: any) => ({
          ...cp,
          date: new Date(cp.date),
          createdAt: new Date(cp.createdAt),
        })),
      });
    }

    // Restaurar facturas en espera (con items)
    if (data.heldSales?.length) {
      for (const hs of data.heldSales) {
        const { items, ...hsData } = hs;
        await db.heldSale.create({
          data: {
            ...hsData,
            createdAt: new Date(hsData.createdAt),
            updatedAt: new Date(hsData.updatedAt),
            items: { create: items },
          },
        });
      }
    }

    // Restaurar cotizaciones (con items)
    if (data.quotes?.length) {
      for (const q of data.quotes) {
        const { items, ...qData } = q;
        await db.quote.create({
          data: {
            ...qData,
            createdAt: new Date(qData.createdAt),
            updatedAt: new Date(qData.updatedAt),
            items: { create: items },
          },
        });
      }
    }

    // Restaurar notas de entrega (con items)
    if (data.deliveryNotes?.length) {
      for (const dn of data.deliveryNotes) {
        const { items, ...dnData } = dn;
        await db.deliveryNote.create({
          data: {
            ...dnData,
            createdAt: new Date(dnData.createdAt),
            updatedAt: new Date(dnData.updatedAt),
            items: { create: items },
          },
        });
      }
    }

    // Restaurar movimientos de inventario
    if (data.inventoryMovements?.length) {
      await db.inventoryMovement.createMany({
        data: data.inventoryMovements.map((im: any) => ({
          ...im,
          date: new Date(im.date),
          createdAt: new Date(im.createdAt),
        })),
      });
    }

    // Restaurar gastos
    if (data.expenses?.length) {
      await db.expense.createMany({
        data: data.expenses.map((e: any) => ({
          ...e,
          date: new Date(e.date),
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        })),
      });
    }

    // Restaurar configuracion
    if (data.settings) {
      await db.settings.create({ data: data.settings });
    }

    // Restaurar licencia
    if (data.license) {
      await db.license.create({ data: data.license });
    }

    // Garantizar que exista el usuario admin
    const adminExists = await db.user.findUnique({ where: { username: 'admin' } });
    if (!adminExists) {
      const { hashPassword } = await import('@/lib/auth');
      await db.user.create({
        data: {
          username: 'admin',
          password: hashPassword('admin'),
          fullName: 'Administrador',
          role: 'admin',
          isActive: true,
          permissions: '{"all":true}',
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Datos restaurados correctamente' });
  } catch (error) {
    console.error('Error restoring data:', error);
    return NextResponse.json({ error: 'Error al restaurar datos' }, { status: 500 });
  }
}
