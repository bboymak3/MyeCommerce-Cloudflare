// Permisos del rol cajero.
//
// El POS tiene dos roles: admin (puede todo) y cajero. Lo que el cajero puede hacer
// lo decide el super admin de Nexus One por negocio (nx_tenants.settings.cajeroPermissions,
// boton "Permisos del cajero"); lo que no se configure toma el valor por defecto de aqui.
// El middleware lo aplica en la API (no solo oculta pantallas) y la pantalla usa lo mismo
// para mostrar u ocultar modulos. Sirve igual en servidor y navegador.
//
// Mantener sincronizado con CAJERO_PERMISSIONS de nexus-one (src/lib/cajero-permissions.ts).

import { normalizeRole } from './roles';
export { normalizeRole, type Role } from './roles';

export const CAJERO_PERMISSIONS = [
  { key: 'ventas', label: 'Vender (punto de venta, ventas en espera, presupuestos y notas de entrega)', default: true },
  { key: 'clientes', label: 'Crear y editar clientes', default: true },
  { key: 'caja', label: 'Turnos y cierre de caja', default: true },
  { key: 'devoluciones', label: 'Devoluciones', default: true },
  { key: 'cobranzas', label: 'Cuentas por cobrar (abonos de clientes)', default: true },
  { key: 'gastos', label: 'Gastos', default: true },
  { key: 'informes', label: 'Dashboard e informes', default: true },
  { key: 'inventario', label: 'Ver kardex, reposicion y catalogo', default: true },
  { key: 'productos', label: 'Crear, editar y eliminar productos, categorias, marcas y ajustes de inventario', default: false },
  { key: 'proveedores', label: 'Proveedores', default: false },
  { key: 'compras', label: 'Compras', default: false },
  { key: 'pagos_proveedores', label: 'Cuentas por pagar (pagos a proveedores)', default: false },
  { key: 'tasa', label: 'Cambiar la tasa del dolar', default: false },
] as const;

export type CajeroPermission = (typeof CAJERO_PERMISSIONS)[number]['key'];
export type PermissionSet = Record<CajeroPermission, boolean>;


/** Permisos del cajero: lo configurado en Nexus One sobre los valores por defecto. */
export function cajeroPermissions(configured?: unknown): PermissionSet {
  const cfg = configured && typeof configured === 'object' ? (configured as Record<string, unknown>) : {};
  const out = {} as PermissionSet;
  for (const p of CAJERO_PERMISSIONS) out[p.key] = typeof cfg[p.key] === 'boolean' ? (cfg[p.key] as boolean) : p.default;
  return out;
}

/** El admin puede todo; el cajero, lo que diga su configuracion. */
export function effectivePermissions(role: unknown, configured?: unknown): PermissionSet {
  if (normalizeRole(role) === 'admin') {
    const all = {} as PermissionSet;
    for (const p of CAJERO_PERMISSIONS) all[p.key] = true;
    return all;
  }
  return cajeroPermissions(configured);
}

// ===== Rutas de la API =====

/** Solo admin (cualquier metodo salvo los indicados en la excepcion). */
const ADMIN_ROUTES: { path: string; except?: string[] }[] = [
  { path: '/api/users' },
  { path: '/api/roles' },
  { path: '/api/backup' },
  { path: '/api/license', except: ['GET'] }, // todos ven la licencia; activarla es del admin
  { path: '/api/logs' },
  { path: '/api/update' },
  { path: '/api/download-version' },
  { path: '/api/check-version' },
  { path: '/api/verificacion' },
  { path: '/api/products/import' },
  { path: '/api/store-logo', except: ['GET'] },
];

const WRITE = ['POST', 'PUT', 'PATCH', 'DELETE'];
const ALL = ['GET', ...WRITE];

/**
 * Permiso que exige cada ruta (para el cajero). Basta con tener UNO de los permisos
 * de la lista. Las rutas que no aparecen quedan abiertas a cualquier usuario del negocio
 * (lecturas que necesita el punto de venta: productos, categorias, clientes, ajustes...).
 */
const PERMISSION_ROUTES: { path: string; methods: string[]; any: CajeroPermission[] }[] = [
  { path: '/api/products', methods: WRITE, any: ['productos'] },
  { path: '/api/categories', methods: WRITE, any: ['productos'] },
  { path: '/api/brands', methods: WRITE, any: ['productos'] },
  { path: '/api/product-images', methods: WRITE, any: ['productos'] },
  { path: '/api/inventory-adjustments', methods: ALL, any: ['productos'] },

  { path: '/api/sales', methods: ['POST'], any: ['ventas'] },
  { path: '/api/held-sales', methods: ALL, any: ['ventas'] },
  { path: '/api/quotes', methods: ALL, any: ['ventas'] },
  { path: '/api/delivery-notes', methods: ALL, any: ['ventas'] },

  { path: '/api/clients/export', methods: ALL, any: ['clientes'] },
  { path: '/api/clients/stats', methods: ALL, any: ['informes'] },
  { path: '/api/clients', methods: ['POST', 'PUT', 'DELETE'], any: ['clientes'] },

  { path: '/api/cash-closing', methods: ALL, any: ['caja'] },
  { path: '/api/cash-shifts', methods: ALL, any: ['caja'] },
  { path: '/api/devolutions', methods: ['POST'], any: ['devoluciones'] },
  { path: '/api/credit', methods: ['POST'], any: ['cobranzas'] },
  { path: '/api/expenses', methods: ALL, any: ['gastos'] },
  { path: '/api/expense-categories', methods: WRITE, any: ['gastos'] },

  { path: '/api/dashboard', methods: ALL, any: ['informes'] },
  { path: '/api/reports', methods: ALL, any: ['informes'] },

  { path: '/api/kardex', methods: ALL, any: ['inventario', 'productos'] },
  { path: '/api/reorder-suggestions', methods: ALL, any: ['inventario', 'compras'] },
  { path: '/api/catalog', methods: ALL, any: ['inventario'] },

  { path: '/api/suppliers', methods: ['GET'], any: ['proveedores', 'compras', 'pagos_proveedores'] },
  { path: '/api/suppliers', methods: WRITE, any: ['proveedores'] },
  { path: '/api/purchases', methods: ALL, any: ['compras'] },
  { path: '/api/supplier-payments', methods: ALL, any: ['pagos_proveedores'] },

  { path: '/api/settings', methods: WRITE, any: ['tasa'] }, // el cajero solo puede cambiar la tasa (ver la ruta)
  { path: '/api/exchange-rate/bcv', methods: ['POST'], any: ['tasa'] },
];

function matches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/');
}

/** true si la ruta es solo para administradores. */
export function isAdminRoute(pathname: string, method: string): boolean {
  return ADMIN_ROUTES.some((r) => matches(pathname, r.path) && !(r.except || []).includes(method));
}

/** Permisos de los que el cajero necesita al menos uno para la ruta, o null si es libre. */
export function requiredPermissions(pathname: string, method: string): CajeroPermission[] | null {
  for (const r of PERMISSION_ROUTES) {
    if (matches(pathname, r.path) && r.methods.includes(method)) return r.any;
  }
  return null;
}

// ===== Pantallas =====

/** Permisos que habilitan cada pestana (al menos uno). Sin entrada: visible para todos. */
export const TAB_PERMISSIONS: Record<string, CajeroPermission[] | 'admin'> = {
  dashboard: ['informes'],
  reports: ['informes'],
  pos: ['ventas'],
  'held-sales': ['ventas'],
  quotes: ['ventas'],
  'delivery-notes': ['ventas'],
  'cash-closing': ['caja'],
  'cash-shifts': ['caja'],
  devolutions: ['devoluciones'],
  credit: ['cobranzas'],
  expenses: ['gastos'],
  kardex: ['inventario', 'productos'],
  reorder: ['inventario', 'compras'],
  catalog: ['inventario'],
  suppliers: ['proveedores'],
  purchases: ['compras'],
  payables: ['pagos_proveedores'],
  users: 'admin',
  config: 'admin',
  license: 'admin',
  backup: 'admin',
};

export function canSeeTab(tab: string, role: unknown, perms: PermissionSet): boolean {
  const rule = TAB_PERMISSIONS[tab];
  if (normalizeRole(role) === 'admin') return true;
  if (!rule) return true;
  if (rule === 'admin') return false;
  return rule.some((k) => perms[k]);
}
