// GET /api/verificacion — chequeo del despliegue (solo administradores).
//
// Abrir en el navegador con la sesion de administrador iniciada: muestra una pagina
// con cada verificacion en verde (ok), amarillo (aviso) o rojo (falla).
// ?format=json devuelve lo mismo en JSON.
//
// Las pruebas de escritura usan un negocio ficticio (VERIFY_TENANT) y se borran al
// terminar: nunca tocan los datos de un negocio real. Nunca muestra secretos.
export const runtime = 'edge';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { createDbFromEnv, getTenantId, DEFAULT_TENANT_ID } from '@/lib/db';
import { D1Batch, expectedSchema, newId, sqlExpr } from '@/lib/d1-batch';
import { getNexusTenant } from '@/lib/nexus-tenant';
import { fetchBcvRate } from '@/lib/bcv-rate';
import { veDateKey, veDayStart, veDayEnd } from '@/lib/ve-time';
import { cajeroPermissions, CAJERO_PERMISSIONS, isAdminRoute, requiredPermissions } from '@/lib/permissions';
import { GET as dashboardGET } from '../dashboard/route';
import { GET as productsGET, POST as productsPOST, PUT as productsPUT, DELETE as productsDELETE } from '../products/route';
import { GET as categoriesGET, POST as categoriesPOST } from '../categories/route';
import { GET as brandsGET } from '../brands/route';
import { GET as clientsGET } from '../clients/route';
import { GET as salesGET, POST as salesPOST } from '../sales/route';
import { GET as quotesGET, POST as quotesPOST } from '../quotes/route';
import { GET as deliveryNotesGET, POST as deliveryNotesPOST } from '../delivery-notes/route';
import { GET as heldSalesGET } from '../held-sales/route';
import { GET as purchasesGET, POST as purchasesPOST } from '../purchases/route';
import { GET as suppliersGET, POST as suppliersPOST } from '../suppliers/route';
import { GET as supplierPaymentsGET } from '../supplier-payments/route';
import { GET as creditGET } from '../credit/route';
import { GET as expensesGET } from '../expenses/route';
import { GET as cashClosingGET, POST as cashClosingPOST } from '../cash-closing/route';
import { GET as cashShiftsGET } from '../cash-shifts/route';
import { GET as kardexGET } from '../kardex/route';
import { GET as reorderGET } from '../reorder-suggestions/route';
import { GET as reportsGET } from '../reports/route';
import { GET as devolutionsGET } from '../devolutions/route';
import { GET as usersGET } from '../users/route';
import { GET as licenseGET } from '../license/route';
import { GET as settingsGET } from '../settings/route';
import { GET as permissionsGET } from '../permissions/route';

const VERIFY_TENANT = '__verificacion__';

type Status = 'ok' | 'aviso' | 'falla';
interface Check { grupo: string; nombre: string; estado: Status; detalle: string }

export async function GET(req: NextRequest) {
  const env = getRequestContext().env as any;
  const d1: D1Database | undefined = env.DB;
  const tenantId = getTenantId(req.headers);
  const checks: Check[] = [];

  async function check(grupo: string, nombre: string, fn: () => Promise<[Status, string]>) {
    try {
      const [estado, detalle] = await fn();
      checks.push({ grupo, nombre, estado, detalle });
    } catch (error: any) {
      checks.push({ grupo, nombre, estado: 'falla', detalle: String(error?.message || error).slice(0, 300) });
    }
  }
  const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

  // ===== Configuracion =====
  const buildCommit = process.env.BUILD_COMMIT || '';
  await check('Configuracion', 'Version desplegada', async () =>
    buildCommit ? ['ok', `commit ${buildCommit.slice(0, 7)}`] : ['aviso', 'Sin commit de build (solo se conoce en despliegues de Cloudflare Pages)']);
  await check('Configuracion', 'Base de datos D1', async () => {
    if (!d1) return ['falla', 'Binding DB no configurado'];
    await d1.prepare('SELECT 1').first();
    return ['ok', 'Conectada'];
  });
  await check('Configuracion', 'Secreto JWT_SECRET', async () =>
    env.JWT_SECRET ? ['ok', 'Configurado'] : ['aviso', 'No configurado: las sesiones usan la clave anterior. npx wrangler pages secret put JWT_SECRET']);
  await check('Configuracion', 'Secreto NEXUS_SSO_SECRET', async () =>
    env.NEXUS_SSO_SECRET ? ['ok', 'Configurado'] : ['falla', 'No configurado: no se puede entrar al POS desde Nexus One']);
  await check('Configuracion', 'Secreto CRON_SECRET', async () =>
    env.CRON_SECRET ? ['ok', 'Configurado'] : ['aviso', 'No configurado: la tasa BCV automatica diaria no funciona']);
  await check('Configuracion', 'Fotos (R2)', async () => {
    const r2: R2Bucket | undefined = env.R2_PHOTOS;
    if (!r2) return ['falla', 'Binding R2_PHOTOS no configurado'];
    const key = `__verificacion__/${newId()}.txt`;
    await r2.put(key, 'ok');
    const back = await (await r2.get(key))?.text();
    await r2.delete(key);
    return back === 'ok' ? ['ok', 'Escritura, lectura y borrado correctos'] : ['falla', 'No se pudo leer lo escrito'];
  });

  if (d1) {
    // ===== Base de datos =====
    await check('Base de datos', 'Tablas y columnas del esquema', async () => {
      const { results } = await d1.prepare(
        `SELECT m.name AS t, p.name AS c FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name LIKE 'pos\\_%' ESCAPE '\\'`
      ).all<{ t: string; c: string }>();
      const actual = new Map<string, Set<string>>();
      for (const r of results) {
        if (!actual.has(r.t)) actual.set(r.t, new Set());
        actual.get(r.t)!.add(r.c);
      }
      const missing: string[] = [];
      let tables = 0;
      for (const [table, cols] of expectedSchema()) {
        tables++;
        const have = actual.get(table);
        if (!have) { missing.push(`tabla ${table}`); continue; }
        for (const c of cols) if (!have.has(c)) missing.push(`${table}.${c}`);
      }
      return missing.length
        ? ['falla', `Faltan: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`]
        : ['ok', `${tables} tablas completas`];
    });
    await check('Base de datos', 'Factura unica por negocio', async () => {
      const idx = await d1.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'pos_sales_tenant_id_invoiceNumber_key'`).first();
      return idx ? ['ok', 'Indice UNIQUE (negocio, numero de factura) presente'] : ['falla', 'Falta el indice UNIQUE de numero de factura'];
    });
    await check('Base de datos', 'Formato de fechas', async () => {
      // Fechas escritas fuera de Prisma con CURRENT_TIMESTAMP ("2026-01-01 10:00:00") rompen los filtros por fecha
      const row = await d1.prepare(
        `SELECT (SELECT COUNT(*) FROM pos_sales WHERE date NOT LIKE '%T%') AS ventas,
                (SELECT COUNT(*) FROM pos_inventory_movements WHERE date NOT LIKE '%T%') AS kardex`
      ).first<{ ventas: number; kardex: number }>();
      const bad = (row?.ventas || 0) + (row?.kardex || 0);
      return bad ? ['aviso', `${row?.ventas} ventas y ${row?.kardex} movimientos con fecha en otro formato`] : ['ok', 'Todas las fechas en formato ISO'];
    });

    // ===== Nexus One =====
    await check('Nexus One', 'Negocio de esta sesion', async () => {
      const nexus = await getNexusTenant(d1, tenantId, env.LEGACY_TENANT_SLUG);
      if (!nexus) return [tenantId === DEFAULT_TENANT_ID ? 'aviso' : 'falla', `tenant ${tenantId}: sin negocio en Nexus One (instalacion independiente)`];
      const corte = nexus.expiresAt ? `, corte ${veDateKey(nexus.expiresAt)}` : ', sin corte';
      return nexus.active
        ? ['ok', `${nexus.name} (${nexus.slug}) activo, plan ${nexus.plan}${corte}`]
        : ['falla', nexus.reason];
    });
    await check('Nexus One', 'Negocio de los datos anteriores', async () => {
      const slug = env.LEGACY_TENANT_SLUG;
      if (!slug) return ['aviso', 'LEGACY_TENANT_SLUG no definido en wrangler.toml'];
      const row = await d1.prepare('SELECT name FROM nx_tenants WHERE slug = ?').bind(slug).first<{ name: string }>();
      if (row) return ['ok', `${slug} -> ${row.name}`];
      // Sin ese negocio solo importa si hay datos anteriores ('default') que quedarian sin dueno
      const legacy = await d1.prepare(
        `SELECT (SELECT COUNT(*) FROM pos_products WHERE tenant_id = 'default') + (SELECT COUNT(*) FROM pos_sales WHERE tenant_id = 'default') AS n`
      ).first<{ n: number }>();
      return legacy?.n
        ? ['falla', `No existe en Nexus One un negocio con slug ${slug} y hay ${legacy.n} productos/ventas anteriores sin negocio`]
        : ['ok', `No hay datos anteriores al modo multi-negocio (${slug} no se usa)`];
    });

    // ===== Escritura atomica (negocio ficticio, se borra al final) =====
    // Restos de una verificacion anterior interrumpida
    await d1.batch(['pos_categories', 'pos_expense_categories'].map((t) => d1.prepare(`DELETE FROM "${t}" WHERE "tenant_id" = ?`).bind(VERIFY_TENANT)));
    await check('Escritura atomica', 'Lote que se completa', async () => {
      const name = `verificacion-${newId()}`;
      const b = new D1Batch(d1, VERIFY_TENANT);
      const id = b.insert('pos_categories', { name });
      await b.commit();
      const saved = await d1.prepare('SELECT id FROM pos_categories WHERE id = ? AND tenant_id = ?').bind(id, VERIFY_TENANT).first();
      const del = new D1Batch(d1, VERIFY_TENANT);
      del.delete('pos_categories', id);
      await del.commit();
      const gone = !(await d1.prepare('SELECT id FROM pos_categories WHERE id = ?').bind(id).first());
      return saved && gone ? ['ok', 'Guardado y borrado correctos'] : ['falla', `guardado=${!!saved} borrado=${gone}`];
    });
    await check('Escritura atomica', 'Lote con error se deshace completo', async () => {
      const b = new D1Batch(d1, VERIFY_TENANT);
      const id = b.insert('pos_categories', { name: `verificacion-${newId()}` });
      b.insert('pos_categories', { id, name: `verificacion-${newId()}` }); // id repetido: falla
      let threw = false;
      try { await b.commit(); } catch { threw = true; }
      const left = await d1.prepare('SELECT id FROM pos_categories WHERE id = ?').bind(id).first();
      if (left) await d1.prepare('DELETE FROM pos_categories WHERE id = ? AND tenant_id = ?').bind(id, VERIFY_TENANT).run();
      if (!threw) return ['falla', 'El lote con error no lanzo excepcion'];
      return left ? ['falla', 'La primera escritura quedo guardada: el lote NO es atomico'] : ['ok', 'Nada quedo guardado (rollback correcto)'];
    });
    await check('Escritura atomica', 'Numero de factura calculado en D1', async () => {
      const b = new D1Batch(d1, VERIFY_TENANT);
      [1, 2].forEach(() => b.insert('pos_expense_categories', {
        name: sqlExpr(`SELECT 'verificacion-' || printf('%08d', COUNT(*) + 1) FROM "pos_expense_categories" WHERE "tenant_id" = ?`, VERIFY_TENANT),
      }));
      await b.commit();
      const { results } = await d1.prepare('SELECT name FROM pos_expense_categories WHERE tenant_id = ? ORDER BY name').bind(VERIFY_TENANT).all<{ name: string }>();
      await d1.prepare('DELETE FROM pos_expense_categories WHERE tenant_id = ?').bind(VERIFY_TENANT).run();
      const names = results.map((r) => r.name);
      return names.length === 2 && names[0] !== names[1]
        ? ['ok', `Correlativos distintos dentro del lote (${names.join(', ')})`]
        : ['falla', `Resultado inesperado: ${names.join(', ') || 'sin filas'}`];
    });

    // ===== Hora de Venezuela =====
    await check('Hora de Venezuela', 'Dia de negocio', async () => {
      const now = new Date();
      const today = veDateKey(now);
      const inside = veDayStart(today) <= now && now <= veDayEnd(today);
      const hora = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' });
      return inside
        ? ['ok', `Hoy en Caracas: ${today} ${hora} (servidor en UTC: ${now.toISOString().slice(0, 16)})`]
        : ['falla', `Rango del dia ${today} no contiene la hora actual`];
    });
  }

  // ===== Datos del negocio (solo lectura) =====
  if (d1) {
    const db = createDbFromEnv(env, tenantId);
    await check('Datos del negocio', 'Lectura con Prisma', async () => {
      const [products, clients, suppliers] = await Promise.all([
        db.product.count({ where: { active: true } }),
        db.client.count(),
        db.supplier.count({ where: { isActive: true } }),
      ]);
      return ['ok', `${products} productos activos, ${clients} clientes, ${suppliers} proveedores`];
    });
    await check('Datos del negocio', 'Ventas de hoy', async () => {
      const today = veDateKey();
      const sales = await db.sale.findMany({ where: { date: { gte: veDayStart(today), lte: veDayEnd(today) } }, select: { total: true } });
      return ['ok', `${sales.length} ventas, $${fmt(sales.reduce((s, v) => s + v.total, 0))}`];
    });
    await check('Datos del negocio', 'Facturas sin repetir', async () => {
      const { results } = await d1.prepare(
        'SELECT invoiceNumber, COUNT(*) n FROM pos_sales WHERE tenant_id = ? GROUP BY invoiceNumber HAVING n > 1 LIMIT 5'
      ).bind(tenantId).all<{ invoiceNumber: string; n: number }>();
      return results.length ? ['falla', `Repetidas: ${results.map((r) => r.invoiceNumber).join(', ')}`] : ['ok', 'Ningun numero de factura repetido'];
    });
    await check('Datos del negocio', 'Stock negativo', async () => {
      const row = await d1.prepare(
        'SELECT COUNT(*) n FROM pos_products WHERE tenant_id = ? AND active = 1 AND noStock = 0 AND stock < 0'
      ).bind(tenantId).first<{ n: number }>();
      return row?.n ? ['aviso', `${row.n} productos con stock negativo (posible venta con "permitir stock en cero")`] : ['ok', 'Ningun producto con stock negativo'];
    });
    await check('Datos del negocio', 'Cuentas por cobrar cuadran', async () => {
      const row = await d1.prepare(
        `SELECT (SELECT COALESCE(SUM(creditBalance), 0) FROM pos_clients WHERE tenant_id = ?1) AS saldo,
                (SELECT COALESCE(SUM(total - creditPaid), 0) FROM pos_sales WHERE tenant_id = ?1 AND isCredit = 1 AND clientId IS NOT NULL) AS pendiente`
      ).bind(tenantId).first<{ saldo: number; pendiente: number }>();
      const diff = Math.abs((row?.saldo || 0) - (row?.pendiente || 0));
      const detail = `saldo de clientes $${fmt(row?.saldo || 0)} / pendiente en ventas a credito $${fmt(row?.pendiente || 0)}`;
      return diff < 0.05 ? ['ok', detail] : ['aviso', `No cuadran: ${detail}`];
    });
    await check('Datos del negocio', 'Cuentas por pagar cuadran', async () => {
      const row = await d1.prepare(
        `SELECT (SELECT COALESCE(SUM(payableBalance), 0) FROM pos_suppliers WHERE tenant_id = ?1) AS saldo,
                (SELECT COALESCE(SUM(totalUsd - paidAmount), 0) FROM pos_purchases WHERE tenant_id = ?1 AND isCredit = 1 AND supplierId IS NOT NULL) AS pendiente`
      ).bind(tenantId).first<{ saldo: number; pendiente: number }>();
      const diff = Math.abs((row?.saldo || 0) - (row?.pendiente || 0));
      const detail = `saldo de proveedores $${fmt(row?.saldo || 0)} / pendiente en compras a credito $${fmt(row?.pendiente || 0)}`;
      return diff < 0.05 ? ['ok', detail] : ['aviso', `No cuadran (p. ej. se elimino una compra a credito): ${detail}`];
    });
  }

  // ===== Roles y licencia =====
  if (d1) {
    await check('Roles y licencia', 'Sin usuarios "vendedor"', async () => {
      const pos = await d1.prepare(`SELECT COUNT(*) n FROM pos_users WHERE role = 'vendedor'`).first<{ n: number }>();
      let nx = 0;
      try { nx = (await d1.prepare(`SELECT COUNT(*) n FROM nx_tenant_users WHERE role = 'vendedor'`).first<{ n: number }>())?.n || 0; } catch {}
      const total = (pos?.n || 0) + nx;
      return total ? ['falla', `${total} usuarios siguen como vendedor (se convierten solos en el proximo arranque)`] : ['ok', 'Solo existen los roles admin y cajero'];
    });
    await check('Roles y licencia', 'El cajero puede leer la licencia (sin TRIAL)', async () => {
      if (isAdminRoute('/api/license', 'GET')) return ['falla', 'La API bloquea la licencia al cajero: la pantalla mostraria TRIAL'];
      const res = await licenseGET(internalRequest(req, '/api/license', 'GET', tenantId, 'cajero'));
      const lic = await res.json() as any;
      if (!res.ok) return ['falla', `La licencia respondio ${res.status}: ${lic?.error || ''}`];
      if (lic.licenseType === 'trial') return ['aviso', 'El negocio no tiene licencia (instalacion sin Nexus One): se vera TRIAL'];
      return ['ok', `Licencia ${lic.licenseType}${lic.features?.noWatermark ? ', sin marca de agua' : ''}`];
    });
    await check('Roles y licencia', 'Activar licencias es solo del admin', async () =>
      isAdminRoute('/api/license', 'POST') ? ['ok', 'El cajero no puede activar claves'] : ['falla', 'El cajero podria activar licencias']);
    await check('Roles y licencia', 'Permisos del cajero en este negocio', async () => {
      const nexus = await getNexusTenant(d1, tenantId, env.LEGACY_TENANT_SLUG);
      const perms = cajeroPermissions(nexus?.cajeroPermissions);
      const si = CAJERO_PERMISSIONS.filter((p) => perms[p.key]).map((p) => p.key);
      const no = CAJERO_PERMISSIONS.filter((p) => !perms[p.key]).map((p) => p.key);
      const origen = nexus?.cajeroPermissions ? 'configurados en Nexus One' : 'valores por defecto';
      return ['ok', `${origen}. Puede: ${si.join(', ') || 'nada'}. No puede: ${no.join(', ') || 'nada'}`];
    });
    await check('Roles y licencia', 'La API aplica los permisos del cajero', async () => {
      const casos: [string, string, boolean][] = [
        ['/api/sales', 'POST', true], ['/api/products', 'POST', true], ['/api/purchases', 'GET', true],
        ['/api/users', 'GET', true], ['/api/products', 'GET', false], ['/api/license', 'GET', false],
      ];
      const malos = casos.filter(([path, m, restringida]) => {
        const r = isAdminRoute(path, m) || !!requiredPermissions(path, m);
        return r !== restringida;
      });
      return malos.length ? ['falla', `Reglas inesperadas: ${malos.map((c) => c[1] + ' ' + c[0]).join(', ')}`] : ['ok', 'Vender, crear productos y compras requieren permiso; usuarios solo admin; ver productos y licencia, libre'];
    });
  }

  // ===== Modulos: lectura real de cada pantalla con este negocio =====
  if (d1) {
    const today = veDateKey();
    // El kardex se consulta por producto (como en su pantalla): se usa uno del negocio
    const anyProduct = await d1.prepare('SELECT id FROM pos_products WHERE tenant_id = ? LIMIT 1').bind(tenantId).first<{ id: string }>();
    const reads: [string, string, (r: NextRequest) => Promise<Response>][] = [
      ['Dashboard', '/api/dashboard', dashboardGET as any],
      ['Productos', '/api/products', productsGET as any],
      ['Categorias', '/api/categories', categoriesGET as any],
      ['Marcas', '/api/brands', brandsGET as any],
      ['Clientes', '/api/clients', clientsGET as any],
      ['Ventas', '/api/sales', salesGET as any],
      ['Presupuestos', '/api/quotes?page=1&limit=20', quotesGET as any],
      ['Notas de entrega', '/api/delivery-notes', deliveryNotesGET as any],
      ['Ventas en espera', '/api/held-sales', heldSalesGET as any],
      ['Compras', '/api/purchases', purchasesGET as any],
      ['Proveedores', '/api/suppliers', suppliersGET as any],
      ['Cuentas por pagar', '/api/supplier-payments', supplierPaymentsGET as any],
      ['Cuentas por cobrar', '/api/credit', creditGET as any],
      ['Gastos', '/api/expenses', expensesGET as any],
      ['Cierre de caja', `/api/cash-closing?preview=true&date=${today}`, cashClosingGET as any],
      ['Turnos de caja', '/api/cash-shifts', cashShiftsGET as any],
      ['Kardex', anyProduct ? `/api/kardex?productId=${encodeURIComponent(anyProduct.id)}` : '', kardexGET as any],
      ['Reposicion', '/api/reorder-suggestions', reorderGET as any],
      ['Informes', `/api/reports?period=today`, reportsGET as any],
      ['Devoluciones', '/api/devolutions', devolutionsGET as any],
      ['Usuarios', '/api/users', usersGET as any],
      ['Configuracion', '/api/settings', settingsGET as any],
      ['Licencia', '/api/license', licenseGET as any],
      ['Permisos', '/api/permissions', permissionsGET as any],
    ];
    for (const [nombre, path, handler] of reads) {
      await check('Modulos (lectura)', nombre, async () => {
        if (!path) return ['ok', 'Sin productos todavia: nada que consultar'];
        const t0 = Date.now();
        const res = await handler(internalRequest(req, path, 'GET', tenantId, 'admin'));
        const ms = Date.now() - t0;
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          return ['falla', `${res.status} ${body.slice(0, 200)}`];
        }
        const body = await res.json().catch(() => null) as any;
        if (body && typeof body === 'object' && !Array.isArray(body) && body.error) return ['falla', String(body.error)];
        const n = Array.isArray(body) ? `${body.length} registros` : 'respuesta valida';
        return [ms > 3000 ? 'aviso' : 'ok', `${n} (${ms} ms)`];
      });
    }
  }

  // ===== Operaciones reales en un negocio ficticio (se borra al terminar) =====
  if (d1) {
    await cleanupTenant(d1, VERIFY_TENANT);
    const call = async (handler: any, path: string, method: string, body?: unknown) => {
      const res: Response = await handler(internalRequest(req, path, method, VERIFY_TENANT, 'admin', body));
      const data = await res.json().catch(() => null) as any;
      if (!res.ok || (data && data.error)) throw new Error(`${res.status} ${data?.error || ''}`.trim());
      return data;
    };
    const ctx: Record<string, any> = {};
    const ops: [string, () => Promise<string>][] = [
      ['Crear categoria', async () => { ctx.cat = await call(categoriesPOST, '/api/categories', 'POST', { name: 'Verificacion' }); return 'ok'; }],
      ['Agregar producto', async () => { ctx.p = await call(productsPOST, '/api/products', 'POST', { name: 'Producto verificacion', price: 2, cost: 1, stock: 10, categoryId: ctx.cat?.id }); return `stock ${ctx.p.stock}`; }],
      ['Editar producto', async () => { const p = await call(productsPUT, '/api/products', 'PUT', { id: ctx.p.id, price: 3 }); return `precio ${p.price}`; }],
      ['Vender', async () => {
        const s = await call(salesPOST, '/api/sales', 'POST', { items: [{ productId: ctx.p.id, quantity: 2, unitPrice: 3, total: 6 }], subtotal: 6, total: 6, totalBs: 240, exchangeRate: 40, paymentMethod: 'efectivo' });
        return `factura ${s.invoiceNumber}`;
      }],
      ['Crear proveedor', async () => { ctx.sup = await call(suppliersPOST, '/api/suppliers', 'POST', { name: 'Proveedor verificacion' }); return 'ok'; }],
      ['Comprar', async () => {
        const c = await call(purchasesPOST, '/api/purchases', 'POST', { supplierId: ctx.sup.id, exchangeRate: 40, items: [{ productId: ctx.p.id, quantity: 5, unitCost: 1 }] });
        return `total $${c.totalUsd}`;
      }],
      ['Crear presupuesto', async () => {
        const q = await call(quotesPOST, '/api/quotes', 'POST', { items: [{ productId: ctx.p.id, productName: 'Producto verificacion', quantity: 1, unitPrice: 3, total: 3 }], subtotal: 3, total: 3, totalBs: 120, exchangeRate: 40, clientName: 'Verificacion' });
        return `presupuesto ${q.number ?? q.id}`;
      }],
      ['Crear nota de entrega', async () => {
        const n = await call(deliveryNotesPOST, '/api/delivery-notes', 'POST', { exchangeRate: 40, items: [{ productId: ctx.p.id, productName: 'Producto verificacion', quantity: 1 }] });
        return `nota ${n.number ?? n.id}`;
      }],
      ['Stock final correcto', async () => {
        const list = await call(productsGET, '/api/products', 'GET');
        const p = (list as any[]).find((x) => x.id === ctx.p.id);
        if (!p) throw new Error('producto no encontrado');
        if (p.stock !== 12) throw new Error(`stock ${p.stock}, se esperaba 12 (10 - 2 vendidos + 5 comprados - 1 nota)`);
        return 'stock 12 (10 - 2 + 5 - 1)';
      }],
      ['Pre-cierre de caja', async () => { const c = await call(cashClosingPOST, '/api/cash-closing', 'POST', { closingType: 'pre' }); return `${c.salesCount} ventas`; }],
      ['Eliminar producto', async () => { await call(productsDELETE, `/api/products?id=${ctx.p.id}`, 'DELETE'); return 'ok'; }],
    ];
    let broken = false;
    for (const [nombre, fn] of ops) {
      await check('Operaciones (negocio de prueba)', nombre, async () => {
        if (broken) return ['aviso', 'No se probo: fallo un paso anterior'];
        try { return ['ok', await fn()]; } catch (e: any) { broken = true; throw e; }
      });
    }
    await check('Operaciones (negocio de prueba)', 'Limpieza del negocio de prueba', async () => {
      const left = await cleanupTenant(d1, VERIFY_TENANT);
      return left ? ['aviso', `Quedaron ${left} filas de prueba`] : ['ok', 'Todo lo creado fue borrado'];
    });
  }

  // ===== Servicios externos =====
  await check('Servicios externos', 'Tasa BCV', async () => {
    try {
      const r = await fetchBcvRate();
      return ['ok', `Bs ${r.usd} por USD (${r.fecha})`];
    } catch (error: any) {
      // El POS sigue funcionando; solo no se puede traer la tasa con el boton "BCV"
      return ['aviso', `Fuente de la tasa no disponible: ${String(error?.message || error).slice(0, 150)}`];
    }
  });

  const summary = {
    ok: checks.filter((c) => c.estado === 'ok').length,
    aviso: checks.filter((c) => c.estado === 'aviso').length,
    falla: checks.filter((c) => c.estado === 'falla').length,
  };
  const payload = { fecha: new Date().toISOString(), negocio: tenantId, resumen: summary, checks };

  if (req.nextUrl.searchParams.get('format') === 'json') {
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  }
  return new NextResponse(renderHtml(payload), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Peticion interna a una ruta de la API, como la recibiria tras el middleware. */
function internalRequest(req: NextRequest, path: string, method: string, tenantId: string, role: string, body?: unknown): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-tenant-id': tenantId,
    'x-user-id': req.headers.get('x-user-id') || 'verificacion',
    'x-user-role': role,
    'x-username': req.headers.get('x-username') || 'verificacion',
  });
  return new NextRequest(new URL(path, req.url), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

// Hijos antes que padres para respetar las claves foraneas
const CLEANUP_ORDER = [
  'pos_sale_items', 'pos_credit_payments', 'pos_devolution_items', 'pos_devolutions', 'pos_inventory_movements',
  'pos_held_sale_items', 'pos_held_sales', 'pos_quote_items', 'pos_quotes', 'pos_delivery_note_items', 'pos_delivery_notes',
  'pos_sales', 'pos_supplier_payments', 'pos_purchase_items', 'pos_purchases', 'pos_combo_items', 'pos_products',
  'pos_categories', 'pos_brands', 'pos_suppliers', 'pos_clients', 'pos_expenses', 'pos_expense_categories',
  'pos_cash_closings', 'pos_cash_shifts', 'pos_settings', 'pos_role_configs', 'pos_users', 'pos_licenses',
];

/** Borra todo lo del negocio de prueba. Devuelve cuantas filas quedaron. */
async function cleanupTenant(d1: D1Database, tenant: string): Promise<number> {
  const tables = [...CLEANUP_ORDER, ...[...expectedSchema().keys()].filter((t) => !CLEANUP_ORDER.includes(t))];
  for (const t of tables) {
    try { await d1.prepare(`DELETE FROM "${t}" WHERE "tenant_id" = ?`).bind(tenant).run(); } catch { /* tabla inexistente */ }
  }
  let left = 0;
  for (const t of tables) {
    try { left += (await d1.prepare(`SELECT COUNT(*) n FROM "${t}" WHERE "tenant_id" = ?`).bind(tenant).first<{ n: number }>())?.n || 0; } catch {}
  }
  return left;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function renderHtml(p: { fecha: string; negocio: string; resumen: Record<Status, number>; checks: Check[] }): string {
  const icon: Record<Status, string> = { ok: '&#10003;', aviso: '!', falla: '&#10007;' };
  const groups = [...new Set(p.checks.map((c) => c.grupo))];
  const overall: Status = p.resumen.falla ? 'falla' : p.resumen.aviso ? 'aviso' : 'ok';
  const title = { ok: 'Todo funciona', aviso: 'Funciona, con avisos', falla: 'Hay fallas' }[overall];
  const hora = new Date(p.fecha).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verificacion POS</title><style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1a1d23;--muted:#667085;--ok:#12805c;--aviso:#b54708;--falla:#c4320a;--line:#e4e7ec}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#181b21;--text:#e8eaee;--muted:#98a2b3;--ok:#3ccb7f;--aviso:#fdb022;--falla:#f97066;--line:#2a2f37}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
main{max-width:760px;margin:0 auto}h1{font-size:22px;margin:4px 0}.meta{color:var(--muted);font-size:13px;margin-bottom:16px}
.banner{background:var(--card);border:1px solid var(--line);border-left:6px solid var(--${overall});border-radius:10px;padding:14px 16px;margin-bottom:18px}
.banner b{color:var(--${overall});font-size:18px}.counts{margin-top:4px;color:var(--muted)}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:20px 0 8px}
.row{display:flex;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:6px}
.i{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-size:13px}
.i.ok{background:var(--ok)}.i.aviso{background:var(--aviso)}.i.falla{background:var(--falla)}
.n{font-weight:600}.d{color:var(--muted);font-size:13px;word-break:break-word}
</style></head><body><main>
<h1>Verificacion del POS</h1><div class="meta">${esc(hora)} (Caracas) &middot; negocio ${esc(p.negocio)} &middot; <a href="?format=json">JSON</a></div>
<div class="banner"><b>${title}</b><div class="counts">${p.resumen.ok} ok &middot; ${p.resumen.aviso} ${p.resumen.aviso === 1 ? 'aviso' : 'avisos'} &middot; ${p.resumen.falla} ${p.resumen.falla === 1 ? 'falla' : 'fallas'}</div></div>
${groups.map((g) => `<h2>${esc(g)}</h2>${p.checks.filter((c) => c.grupo === g).map((c) =>
  `<div class="row"><div class="i ${c.estado}">${icon[c.estado]}</div><div><div class="n">${esc(c.nombre)}</div><div class="d">${esc(c.detalle)}</div></div></div>`).join('')}`).join('')}
</main></body></html>`;
}
