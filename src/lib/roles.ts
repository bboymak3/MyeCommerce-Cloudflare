// Roles del POS: admin y cajero. El antiguo 'vendedor' se fusiono en 'cajero'
// (la migracion automatica convierte los usuarios existentes; ver schema-migrate.ts).
export type Role = 'admin' | 'cajero';

export function normalizeRole(role: unknown): Role {
  return role === 'admin' ? 'admin' : 'cajero';
}
