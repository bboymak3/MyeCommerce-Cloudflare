-- Migracion 0001: aislamiento multi-negocio en una D1 existente.
-- Aplicar UNA vez sobre la D1 de produccion:
--   npx wrangler d1 execute myecommerce-ferreteria-central --remote --file=./prisma/d1-migrations/0001_multitenant.sql
--
-- Requisito: todas las tablas ya tienen la columna tenant_id (agregada el 2026-09-04, ver worklog.md).
-- Si alguna tabla no la tiene, agreguela antes con:
--   ALTER TABLE "<tabla>" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- 1) Quitar los indices UNIQUE globales: impedian que dos negocios tuvieran
--    el mismo usuario 'admin', la misma categoria o el mismo numero de factura.
DROP INDEX IF EXISTS "categories_name_key";
DROP INDEX IF EXISTS "Category_name_key";
DROP INDEX IF EXISTS "brands_name_key";
DROP INDEX IF EXISTS "Brand_name_key";
DROP INDEX IF EXISTS "clients_docNumber_key";
DROP INDEX IF EXISTS "Client_docNumber_key";
DROP INDEX IF EXISTS "sales_invoiceNumber_key";
DROP INDEX IF EXISTS "Sale_invoiceNumber_key";
DROP INDEX IF EXISTS "licenses_machineId_key";
DROP INDEX IF EXISTS "License_machineId_key";
DROP INDEX IF EXISTS "users_username_key";
DROP INDEX IF EXISTS "User_username_key";
DROP INDEX IF EXISTS "role_configs_roleName_key";
DROP INDEX IF EXISTS "RoleConfig_roleName_key";
DROP INDEX IF EXISTS "expense_categories_name_key";
DROP INDEX IF EXISTS "ExpenseCategory_name_key";

-- 2) Unicidad por negocio.
CREATE UNIQUE INDEX IF NOT EXISTS "categories_tenant_id_name_key" ON "categories"("tenant_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "brands_tenant_id_name_key" ON "brands"("tenant_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "clients_tenant_id_docNumber_key" ON "clients"("tenant_id", "docNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_tenant_id_invoiceNumber_key" ON "sales"("tenant_id", "invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "licenses_tenant_id_machineId_key" ON "licenses"("tenant_id", "machineId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_username_key" ON "users"("tenant_id", "username");
CREATE UNIQUE INDEX IF NOT EXISTS "role_configs_tenant_id_roleName_key" ON "role_configs"("tenant_id", "roleName");
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_tenant_id_name_key" ON "expense_categories"("tenant_id", "name");

-- 3) Indice por tenant_id en todas las tablas.
CREATE INDEX IF NOT EXISTS "products_tenant_id_idx" ON "products"("tenant_id");
CREATE INDEX IF NOT EXISTS "categories_tenant_id_idx" ON "categories"("tenant_id");
CREATE INDEX IF NOT EXISTS "brands_tenant_id_idx" ON "brands"("tenant_id");
CREATE INDEX IF NOT EXISTS "clients_tenant_id_idx" ON "clients"("tenant_id");
CREATE INDEX IF NOT EXISTS "sales_tenant_id_idx" ON "sales"("tenant_id");
CREATE INDEX IF NOT EXISTS "sale_items_tenant_id_idx" ON "sale_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "settings_tenant_id_idx" ON "settings"("tenant_id");
CREATE INDEX IF NOT EXISTS "devolutions_tenant_id_idx" ON "devolutions"("tenant_id");
CREATE INDEX IF NOT EXISTS "devolution_items_tenant_id_idx" ON "devolution_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "licenses_tenant_id_idx" ON "licenses"("tenant_id");
CREATE INDEX IF NOT EXISTS "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX IF NOT EXISTS "role_configs_tenant_id_idx" ON "role_configs"("tenant_id");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");
CREATE INDEX IF NOT EXISTS "purchases_tenant_id_idx" ON "purchases"("tenant_id");
CREATE INDEX IF NOT EXISTS "combo_items_tenant_id_idx" ON "combo_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "purchase_items_tenant_id_idx" ON "purchase_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "credit_payments_tenant_id_idx" ON "credit_payments"("tenant_id");
CREATE INDEX IF NOT EXISTS "inventory_movements_tenant_id_idx" ON "inventory_movements"("tenant_id");
CREATE INDEX IF NOT EXISTS "held_sales_tenant_id_idx" ON "held_sales"("tenant_id");
CREATE INDEX IF NOT EXISTS "held_sale_items_tenant_id_idx" ON "held_sale_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "quotes_tenant_id_idx" ON "quotes"("tenant_id");
CREATE INDEX IF NOT EXISTS "quote_items_tenant_id_idx" ON "quote_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "delivery_notes_tenant_id_idx" ON "delivery_notes"("tenant_id");
CREATE INDEX IF NOT EXISTS "delivery_note_items_tenant_id_idx" ON "delivery_note_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "expense_categories_tenant_id_idx" ON "expense_categories"("tenant_id");
CREATE INDEX IF NOT EXISTS "expenses_tenant_id_idx" ON "expenses"("tenant_id");
