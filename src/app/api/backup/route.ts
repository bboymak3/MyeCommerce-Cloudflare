import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const [products, categories, sales, settings, devolutions, cashClosings, license, users, clients] = await Promise.all([
      db.product.findMany(),
      db.category.findMany(),
      db.sale.findMany({ include: { items: true } }),
      db.settings.findFirst(),
      db.devolution.findMany({ include: { items: true } }),
      db.cashClosing.findMany(),
      db.license.findFirst(),
      db.user.findMany({ select: { id: true, username: true, fullName: true, role: true, isActive: true, permissions: true, avatar: true, lastLogin: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'asc' } }),
      db.client.findMany(),
    ]);

    return NextResponse.json({
      version: '2.9.55',
      exportedAt: new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
      products,
      categories,
      clients,
      users,
      sales,
      devolutions,
      cashClosings,
      settings,
      license,
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
    await db.devolutionItem.deleteMany();
    await db.devolution.deleteMany();
    await db.cashClosing.deleteMany();
    await db.saleItem.deleteMany();
    await db.sale.deleteMany();
    await db.product.deleteMany();
    await db.category.deleteMany();
    await db.settings.deleteMany();
    await db.license.deleteMany();
    await db.user.deleteMany();
    await db.client.deleteMany();

    // Restaurar usuarios (incluyendo admin)
    if (data.users?.length) {
      await db.user.createMany({ data: data.users });
    }

    // Restaurar clientes
    if (data.clients?.length) {
      await db.client.createMany({ data: data.clients });
    }

    // Restaurar categorías
    if (data.categories?.length) {
      await db.category.createMany({ data: data.categories });
    }

    // Restaurar productos
    if (data.products?.length) {
      await db.product.createMany({ data: data.products });
    }

    // Restaurar ventas
    if (data.sales?.length) {
      for (const sale of data.sales) {
        const { items, ...saleData } = sale;
        await db.sale.create({
          data: {
            ...saleData,
            date: new Date(saleData.date),
            createdAt: new Date(saleData.createdAt),
            items: {
              create: items,
            },
          },
        });
      }
    }

    // Restaurar devoluciones
    if (data.devolutions?.length) {
      for (const dev of data.devolutions) {
        const { items, ...devData } = dev;
        await db.devolution.create({
          data: {
            ...devData,
            date: new Date(devData.date),
            createdAt: new Date(devData.createdAt),
            items: {
              create: items,
            },
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

    // Restaurar configuración
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
