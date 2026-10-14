// Movimientos de dinero que no son ventas: abonos cobrados (cuentas por cobrar), gastos
// pagados y pagos a proveedores (cuentas por pagar). Los usan el cierre de caja y el
// cierre de turno para calcular el efectivo que deberia haber en la caja.
//
// Efectivo: el metodo 'efectivo' es efectivo en Bs (cuenta su monto en Bs) y
// 'efectivo-usd' es efectivo en dolares (cuenta su monto en $).

export interface MovementTotals {
  usd: number;
  bs: number;
  count: number;
  byMethod: Record<string, { usd: number; bs: number; count: number }>;
}

export interface CashMovements {
  /** Abonos de clientes cobrados (entra dinero) */
  abonos: MovementTotals;
  /** Gastos pagados (sale dinero) */
  gastos: MovementTotals;
  /** Pagos a proveedores (sale dinero) */
  pagosProveedores: MovementTotals;
  /** Devoluciones de ventas a credito descontadas de la deuda: no sale dinero de la caja */
  devolucionesACredito: { usd: number; bs: number; count: number };
  /** Efectivo neto de estos movimientos (abonos - gastos - pagos), por moneda */
  efectivoNeto: { bs: number; usd: number };
}

interface Row { amount: number; amountBs: number; method: string }

const round2 = (n: number) => Math.round(n * 100) / 100;

function emptyTotals(): MovementTotals {
  return { usd: 0, bs: 0, count: 0, byMethod: {} };
}

function addRow(t: MovementTotals, r: Row) {
  const method = (r.method || 'otro').toLowerCase();
  const usd = Number(r.amount) || 0;
  const bs = Number(r.amountBs) || 0;
  t.usd += usd; t.bs += bs; t.count++;
  const m = t.byMethod[method] || (t.byMethod[method] = { usd: 0, bs: 0, count: 0 });
  m.usd += usd; m.bs += bs; m.count++;
}

function roundTotals(t: MovementTotals): MovementTotals {
  const byMethod: MovementTotals['byMethod'] = {};
  for (const [k, v] of Object.entries(t.byMethod)) byMethod[k] = { usd: round2(v.usd), bs: round2(v.bs), count: v.count };
  return { usd: round2(t.usd), bs: round2(t.bs), count: t.count, byMethod };
}

/** Efectivo de un total por metodo: Bs de 'efectivo' y $ de 'efectivo-usd'. */
export function cashOf(t: MovementTotals): { bs: number; usd: number } {
  return { bs: t.byMethod['efectivo']?.bs || 0, usd: t.byMethod['efectivo-usd']?.usd || 0 };
}

export interface MovementFilter {
  /** Solo lo registrado por este usuario (cierre de turno) */
  userId?: string;
  username?: string;
}

/**
 * Suma los movimientos con fecha en [from, to]. `db` es el cliente Prisma del negocio
 * (createDbFromEnv), que ya filtra por tenant_id.
 */
export async function loadCashMovements(db: any, from: Date, to: Date, filter: MovementFilter = {}): Promise<CashMovements> {
  const range = { gte: from, lte: to };
  const byUser = filter.username !== undefined;
  const [payments, expenses, supplierPayments] = await Promise.all([
    db.creditPayment.findMany({ where: { date: range, ...(byUser ? { createdBy: filter.username } : {}) } }),
    db.expense.findMany({ where: { date: range, ...(filter.userId !== undefined ? { userId: filter.userId } : {}) } }),
    db.supplierPayment.findMany({ where: { date: range, ...(byUser ? { createdBy: filter.username } : {}) } }),
  ]);

  const abonos = emptyTotals();
  const devolucionesACredito = { usd: 0, bs: 0, count: 0 };
  for (const p of payments as any[]) {
    if (p.method === 'devolucion') {
      devolucionesACredito.usd += Number(p.amount) || 0;
      devolucionesACredito.bs += Number(p.amountBs) || 0;
      devolucionesACredito.count++;
    } else {
      addRow(abonos, { amount: p.amount, amountBs: p.amountBs, method: p.method });
    }
  }
  const gastos = emptyTotals();
  for (const e of expenses as any[]) addRow(gastos, { amount: e.amount, amountBs: e.amountBs, method: e.paymentMethod });
  const pagosProveedores = emptyTotals();
  for (const s of supplierPayments as any[]) addRow(pagosProveedores, { amount: s.amount, amountBs: s.amountBs, method: s.method });

  const inCash = cashOf(abonos), outGastos = cashOf(gastos), outPagos = cashOf(pagosProveedores);
  return {
    abonos: roundTotals(abonos),
    gastos: roundTotals(gastos),
    pagosProveedores: roundTotals(pagosProveedores),
    devolucionesACredito: { usd: round2(devolucionesACredito.usd), bs: round2(devolucionesACredito.bs), count: devolucionesACredito.count },
    efectivoNeto: {
      bs: round2(inCash.bs - outGastos.bs - outPagos.bs),
      usd: round2(inCash.usd - outGastos.usd - outPagos.usd),
    },
  };
}

/**
 * Devoluciones del periodo: total, la parte descontada de deudas de ventas a credito
 * (no salio dinero) y lo reembolsado. `keep` filtra por la venta (vendedor, rol).
 */
export async function loadReturns(db: any, from: Date, to: Date, keep: (sale: any) => boolean = () => true) {
  const all = await db.devolution.findMany({
    where: { date: { gte: from, lte: to } },
    include: { sale: { select: { sellerName: true, sellerRole: true } } },
  });
  const devs = (all as any[]).filter((d) => keep(d.sale || {}));
  const ids = devs.map((d) => d.id);
  const credit = ids.length
    ? await db.creditPayment.findMany({ where: { method: 'devolucion', reference: { in: ids } }, select: { amount: true, amountBs: true } })
    : [];
  const totalUsd = devs.reduce((s, d) => s + (Number(d.totalUsd) || 0), 0);
  const totalBs = devs.reduce((s, d) => s + (Number(d.totalBs) || 0), 0);
  const creditUsd = (credit as any[]).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const creditBs = (credit as any[]).reduce((s, c) => s + (Number(c.amountBs) || 0), 0);
  return {
    count: devs.length,
    totalUsd: round2(totalUsd), totalBs: round2(totalBs),
    creditUsd: round2(creditUsd), creditBs: round2(creditBs),
    cashUsd: round2(Math.max(0, totalUsd - creditUsd)), cashBs: round2(Math.max(0, totalBs - creditBs)),
  };
}
