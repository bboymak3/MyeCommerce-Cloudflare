-- Migracion 0002 (opcional): asignar los datos existentes ('default') a un negocio de nexus-one.
--
-- Los datos creados antes del modo multi-negocio tienen tenant_id = 'default'.
-- Si esos datos pertenecen a un negocio creado en nexus-one (p. ej. Ferreteria Central),
-- reemplace TENANT_ID_AQUI por el id del negocio (columna tenants.id en nexus-one-db, formato 'tn-...')
-- y ejecute:
--   npx wrangler d1 execute myecommerce-ferreteria-central --remote --file=./prisma/d1-migrations/0002_assign_default_tenant.sql

UPDATE "products" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "categories" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "brands" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "clients" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "sales" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "sale_items" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "settings" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "devolutions" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "devolution_items" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "licenses" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "CashClosing" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "users" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "role_configs" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "suppliers" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "purchases" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "combo_items" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "purchase_items" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "credit_payments" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "inventory_movements" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "held_sales" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "held_sale_items" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "quotes" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "quote_items" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "delivery_notes" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "delivery_note_items" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "expense_categories" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
UPDATE "expenses" SET tenant_id = 'TENANT_ID_AQUI' WHERE tenant_id = 'default';
