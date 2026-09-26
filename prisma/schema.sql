-- MyeCommerce POS - esquema D1 (SQLite) multi-negocio. Tablas con prefijo pos_ (comparten la D1 con nexus-one, cuyas tablas usan nx_).
-- Generado desde prisma/schema.prisma con: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- Cada tabla lleva tenant_id (id del negocio en nexus-one; 'default' = negocio LEGACY_TENANT_SLUG).

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "barcode" TEXT NOT NULL DEFAULT '',
    "secondaryBarcode" TEXT NOT NULL DEFAULT '',
    "price" REAL NOT NULL,
    "cost" REAL NOT NULL DEFAULT 0,
    "marginPercent" REAL NOT NULL DEFAULT 0,
    "taxType" TEXT NOT NULL DEFAULT 'general',
    "stock" REAL NOT NULL DEFAULT 0,
    "minStock" REAL NOT NULL DEFAULT 5,
    "icon" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "wholesalePrice" REAL NOT NULL DEFAULT 0,
    "wholesaleCost" REAL NOT NULL DEFAULT 0,
    "wholesaleMarginPercent" REAL NOT NULL DEFAULT 0,
    "minWholesaleQty" INTEGER NOT NULL DEFAULT 0,
    "noStock" BOOLEAN NOT NULL DEFAULT false,
    "vendePorPeso" BOOLEAN NOT NULL DEFAULT false,
    "unidadPeso" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "expirationDate" DATETIME,
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "isCombo" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "unitsPerBox" INTEGER NOT NULL DEFAULT 0,
    "boxPrice" REAL NOT NULL DEFAULT 0,
    "boxMarginPercent" REAL NOT NULL DEFAULT 0,
    "granMayorPrice" REAL NOT NULL DEFAULT 0,
    "isGranMayor" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "brandId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pos_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "pos_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "pos_brands" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_brands" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "type" TEXT NOT NULL DEFAULT 'natural',
    "docType" TEXT NOT NULL DEFAULT 'V',
    "docNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "businessName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "taxInfo" TEXT NOT NULL DEFAULT '',
    "isFinalClient" BOOLEAN NOT NULL DEFAULT false,
    "creditBalance" REAL NOT NULL DEFAULT 0,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "date" DATETIME NOT NULL,
    "subtotal" REAL NOT NULL,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "totalBs" REAL NOT NULL,
    "exchangeRate" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'efectivo',
    "referenceNumber" TEXT NOT NULL DEFAULT '',
    "mixedPaymentJson" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL DEFAULT '',
    "clientDocType" TEXT NOT NULL DEFAULT '',
    "clientDocNumber" TEXT NOT NULL DEFAULT '',
    "clientName" TEXT NOT NULL DEFAULT '',
    "clientAddress" TEXT NOT NULL DEFAULT '',
    "sellerName" TEXT NOT NULL DEFAULT '',
    "sellerRole" TEXT NOT NULL DEFAULT '',
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "creditPaid" REAL NOT NULL DEFAULT 0,
    "creditDays" INTEGER NOT NULL DEFAULT 30,
    "creditDueDate" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT,
    "shiftId" TEXT,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_sales_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "pos_clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_sales_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "pos_cash_shifts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_sale_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "pos_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "storeName" TEXT NOT NULL DEFAULT 'Mi Tienda',
    "storeAddress" TEXT NOT NULL DEFAULT '',
    "storePhone" TEXT NOT NULL DEFAULT '',
    "storeRif" TEXT NOT NULL DEFAULT '',
    "bcvRate" REAL NOT NULL DEFAULT 36.50,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "allowZeroStock" BOOLEAN NOT NULL DEFAULT false,
    "enableDiscount" BOOLEAN NOT NULL DEFAULT false,
    "maxDiscountPct" INTEGER NOT NULL DEFAULT 20,
    "theme" TEXT NOT NULL DEFAULT 'blue',
    "ticketFontSize" INTEGER NOT NULL DEFAULT 8,
    "ticketFontFamily" TEXT NOT NULL DEFAULT 'monospace',
    "ticketHeaderMsg" TEXT NOT NULL DEFAULT '',
    "ticketFooterMsg" TEXT NOT NULL DEFAULT 'Gracias por su compra!',
    "ticketShowPhone" BOOLEAN NOT NULL DEFAULT true,
    "ticketShowSeller" BOOLEAN NOT NULL DEFAULT true,
    "ticketShowExchange" BOOLEAN NOT NULL DEFAULT true,
    "ticketCurrencyMode" TEXT NOT NULL DEFAULT 'dual',
    "ticketShowSlogan" BOOLEAN NOT NULL DEFAULT false,
    "ticketBold" BOOLEAN NOT NULL DEFAULT true,
    "ticketPaperWidth" TEXT NOT NULL DEFAULT '58mm',
    "ticketMarginLeft" REAL NOT NULL DEFAULT 0,
    "ticketMarginRight" REAL NOT NULL DEFAULT 0,
    "ticketUseAgent" BOOLEAN NOT NULL DEFAULT true,
    "ticketAgentUrl" TEXT NOT NULL DEFAULT 'http://localhost:9100',
    "ticketShowCashReceived" BOOLEAN NOT NULL DEFAULT true,
    "ticketShowLogo" BOOLEAN NOT NULL DEFAULT true,
    "storeLogo" TEXT NOT NULL DEFAULT '',
    "businessType" TEXT NOT NULL DEFAULT 'general',
    "taxMode" TEXT NOT NULL DEFAULT 'included',
    "themeMode" TEXT NOT NULL DEFAULT 'light',
    "euroUsdtRate" REAL NOT NULL DEFAULT 0,
    "promoActive" BOOLEAN NOT NULL DEFAULT true,
    "promoLabel" TEXT NOT NULL DEFAULT 'PRECIO EXCLUSIVO',
    "promoOldPrice" REAL NOT NULL DEFAULT 280,
    "promoCurrentPrice" REAL NOT NULL DEFAULT 180,
    "promoExpiryDate" TEXT NOT NULL DEFAULT '',
    "bcvAutoUpdate" BOOLEAN NOT NULL DEFAULT false,
    "bcvSource" TEXT NOT NULL DEFAULT 'manual',
    "bcvUpdatedAt" DATETIME,
    "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyPointsPerUsd" REAL NOT NULL DEFAULT 100,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_devolutions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "saleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "totalUsd" REAL NOT NULL,
    "totalBs" REAL NOT NULL,
    "exchangeRate" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completada',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_devolutions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_devolution_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "devolutionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "pos_devolution_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_devolution_items_devolutionId_fkey" FOREIGN KEY ("devolutionId") REFERENCES "pos_devolutions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_licenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "machineId" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL DEFAULT '',
    "licenseType" TEXT NOT NULL DEFAULT 'trial',
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "maxProducts" INTEGER NOT NULL DEFAULT 30,
    "maxDailySales" INTEGER NOT NULL DEFAULT 15,
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxActivations" INTEGER NOT NULL DEFAULT 1,
    "activationCount" INTEGER NOT NULL DEFAULT 1,
    "previousMachines" TEXT NOT NULL DEFAULT '',
    "blockedReason" TEXT NOT NULL DEFAULT '',
    "ownerName" TEXT NOT NULL DEFAULT '',
    "ownerEmail" TEXT NOT NULL DEFAULT '',
    "ownerPhone" TEXT NOT NULL DEFAULT '',
    "ownerRif" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_cash_closings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "date" DATETIME NOT NULL,
    "closingType" TEXT NOT NULL DEFAULT 'final',
    "sellerName" TEXT NOT NULL DEFAULT '',
    "sellerRole" TEXT NOT NULL DEFAULT '',
    "totalSalesUsd" REAL NOT NULL DEFAULT 0,
    "totalSalesBs" REAL NOT NULL DEFAULT 0,
    "totalReturnsUsd" REAL NOT NULL DEFAULT 0,
    "totalReturnsBs" REAL NOT NULL DEFAULT 0,
    "netTotalUsd" REAL NOT NULL DEFAULT 0,
    "netTotalBs" REAL NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "returnsCount" INTEGER NOT NULL DEFAULT 0,
    "cashUsd" REAL NOT NULL DEFAULT 0,
    "cashBs" REAL NOT NULL DEFAULT 0,
    "cardUsd" REAL NOT NULL DEFAULT 0,
    "cardBs" REAL NOT NULL DEFAULT 0,
    "checkUsd" REAL NOT NULL DEFAULT 0,
    "checkBs" REAL NOT NULL DEFAULT 0,
    "transferUsd" REAL NOT NULL DEFAULT 0,
    "transferBs" REAL NOT NULL DEFAULT 0,
    "mobileUsd" REAL NOT NULL DEFAULT 0,
    "mobileBs" REAL NOT NULL DEFAULT 0,
    "efectivoUsdUsd" REAL NOT NULL DEFAULT 0,
    "efectivoUsdBs" REAL NOT NULL DEFAULT 0,
    "creditSalesUsd" REAL NOT NULL DEFAULT 0,
    "creditSalesBs" REAL NOT NULL DEFAULT 0,
    "creditSalesCount" INTEGER NOT NULL DEFAULT 0,
    "casheaSalesUsd" REAL NOT NULL DEFAULT 0,
    "casheaSalesBs" REAL NOT NULL DEFAULT 0,
    "casheaSalesCount" INTEGER NOT NULL DEFAULT 0,
    "zelleUsd" REAL NOT NULL DEFAULT 0,
    "zelleBs" REAL NOT NULL DEFAULT 0,
    "usdtUsd" REAL NOT NULL DEFAULT 0,
    "usdtBs" REAL NOT NULL DEFAULT 0,
    "breakdownJson" TEXT NOT NULL DEFAULT '{}',
    "exchangeRate" REAL NOT NULL DEFAULT 0,
    "observations" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'cajero',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permissions" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL DEFAULT '',
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_role_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "roleName" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "rif" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "payableBalance" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "number" TEXT NOT NULL DEFAULT '',
    "supplierId" TEXT,
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "exchangeRate" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pos_purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "pos_suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_supplier_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "purchaseId" TEXT NOT NULL,
    "supplierId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" REAL NOT NULL,
    "exchangeRate" REAL NOT NULL DEFAULT 0,
    "amountBs" REAL NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT 'efectivo',
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_supplier_payments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "pos_purchases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "pos_suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_cash_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "userRole" TEXT NOT NULL DEFAULT '',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "openingCashUsd" REAL NOT NULL DEFAULT 0,
    "openingCashBs" REAL NOT NULL DEFAULT 0,
    "closingCashUsd" REAL,
    "closingCashBs" REAL,
    "expectedCashUsd" REAL NOT NULL DEFAULT 0,
    "expectedCashBs" REAL NOT NULL DEFAULT 0,
    "diffUsd" REAL NOT NULL DEFAULT 0,
    "diffBs" REAL NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_combo_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "comboId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "pos_combo_items_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "pos_products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_combo_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_purchase_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "total" REAL NOT NULL,
    "isBox" BOOLEAN NOT NULL DEFAULT false,
    "unitsPerBox" REAL NOT NULL DEFAULT 0,
    "boxQty" REAL NOT NULL DEFAULT 0,
    "boxCost" REAL NOT NULL DEFAULT 0,
    "calcUnitCost" REAL NOT NULL DEFAULT 0,
    "calcMargin" REAL NOT NULL DEFAULT 0,
    "calcPrice" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pos_purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "pos_purchases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_credit_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "saleId" TEXT NOT NULL,
    "clientId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" REAL NOT NULL,
    "exchangeRate" REAL NOT NULL,
    "amountBs" REAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'efectivo',
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_credit_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_credit_payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "pos_clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_inventory_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "productId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movementType" TEXT NOT NULL,
    "concept" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL,
    "absQuantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "balanceQty" REAL NOT NULL DEFAULT 0,
    "balanceTotalCost" REAL NOT NULL DEFAULT 0,
    "balanceAvgCost" REAL NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "userRole" TEXT NOT NULL DEFAULT '',
    "referenceId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_held_sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "number" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "clientName" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "exchangeRate" REAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'efectivo',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'espera',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pos_held_sales_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "pos_clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_held_sale_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "heldSaleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    "taxType" TEXT NOT NULL DEFAULT 'general',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_held_sale_items_heldSaleId_fkey" FOREIGN KEY ("heldSaleId") REFERENCES "pos_held_sales" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_quotes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "number" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "clientName" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "exchangeRate" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "validUntil" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pos_quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "pos_clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_quote_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    "taxType" TEXT NOT NULL DEFAULT 'general',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "pos_quotes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_delivery_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "number" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "recipientName" TEXT NOT NULL DEFAULT '',
    "recipientDoc" TEXT NOT NULL DEFAULT '',
    "recipientAddr" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "exchangeRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'emitida',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_delivery_note_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "deliveryNoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_delivery_note_items_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "pos_delivery_notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_expense_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'receipt',
    "color" TEXT NOT NULL DEFAULT '#ef4444',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pos_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "amountBs" REAL NOT NULL DEFAULT 0,
    "exchangeRate" REAL NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'efectivo',
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pos_expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "pos_expense_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_expenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "pos_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_products_tenant_id_idx" ON "pos_products"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_categories_tenant_id_idx" ON "pos_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_categories_tenant_id_name_key" ON "pos_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_brands_tenant_id_idx" ON "pos_brands"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_brands_tenant_id_name_key" ON "pos_brands"("tenant_id", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_clients_docNumber_idx" ON "pos_clients"("docNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_clients_fullName_idx" ON "pos_clients"("fullName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_clients_type_idx" ON "pos_clients"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_clients_tenant_id_idx" ON "pos_clients"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_clients_tenant_id_docNumber_key" ON "pos_clients"("tenant_id", "docNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_sales_date_idx" ON "pos_sales"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_sales_clientId_idx" ON "pos_sales"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_sales_shiftId_idx" ON "pos_sales"("shiftId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_sales_tenant_id_idx" ON "pos_sales"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_sales_tenant_id_invoiceNumber_key" ON "pos_sales"("tenant_id", "invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_sale_items_tenant_id_idx" ON "pos_sale_items"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_settings_tenant_id_idx" ON "pos_settings"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_devolutions_date_idx" ON "pos_devolutions"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_devolutions_saleId_idx" ON "pos_devolutions"("saleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_devolutions_tenant_id_idx" ON "pos_devolutions"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_devolution_items_tenant_id_idx" ON "pos_devolution_items"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_licenses_tenant_id_idx" ON "pos_licenses"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_licenses_tenant_id_machineId_key" ON "pos_licenses"("tenant_id", "machineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_cash_closings_date_idx" ON "pos_cash_closings"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_users_tenant_id_idx" ON "pos_users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_users_tenant_id_username_key" ON "pos_users"("tenant_id", "username");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_role_configs_tenant_id_idx" ON "pos_role_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_role_configs_tenant_id_roleName_key" ON "pos_role_configs"("tenant_id", "roleName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_suppliers_name_idx" ON "pos_suppliers"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_suppliers_tenant_id_idx" ON "pos_suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_purchases_date_idx" ON "pos_purchases"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_purchases_supplierId_idx" ON "pos_purchases"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_purchases_tenant_id_idx" ON "pos_purchases"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_supplier_payments_date_idx" ON "pos_supplier_payments"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_supplier_payments_purchaseId_idx" ON "pos_supplier_payments"("purchaseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_supplier_payments_supplierId_idx" ON "pos_supplier_payments"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_supplier_payments_tenant_id_idx" ON "pos_supplier_payments"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_cash_shifts_tenant_id_idx" ON "pos_cash_shifts"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_cash_shifts_userId_idx" ON "pos_cash_shifts"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_cash_shifts_status_idx" ON "pos_cash_shifts"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_combo_items_tenant_id_idx" ON "pos_combo_items"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_purchase_items_tenant_id_idx" ON "pos_purchase_items"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_credit_payments_date_idx" ON "pos_credit_payments"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_credit_payments_saleId_idx" ON "pos_credit_payments"("saleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_credit_payments_clientId_idx" ON "pos_credit_payments"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_credit_payments_tenant_id_idx" ON "pos_credit_payments"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_inventory_movements_productId_idx" ON "pos_inventory_movements"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_inventory_movements_date_idx" ON "pos_inventory_movements"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_inventory_movements_movementType_idx" ON "pos_inventory_movements"("movementType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_inventory_movements_tenant_id_idx" ON "pos_inventory_movements"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_held_sales_userId_idx" ON "pos_held_sales"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_held_sales_status_idx" ON "pos_held_sales"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_held_sales_tenant_id_idx" ON "pos_held_sales"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_held_sale_items_tenant_id_idx" ON "pos_held_sale_items"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_quotes_userId_idx" ON "pos_quotes"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_quotes_status_idx" ON "pos_quotes"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_quotes_tenant_id_idx" ON "pos_quotes"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_quote_items_tenant_id_idx" ON "pos_quote_items"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_delivery_notes_userId_idx" ON "pos_delivery_notes"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_delivery_notes_status_idx" ON "pos_delivery_notes"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_delivery_notes_createdAt_idx" ON "pos_delivery_notes"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_delivery_notes_tenant_id_idx" ON "pos_delivery_notes"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_delivery_note_items_tenant_id_idx" ON "pos_delivery_note_items"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_expense_categories_tenant_id_idx" ON "pos_expense_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_expense_categories_tenant_id_name_key" ON "pos_expense_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_expenses_date_idx" ON "pos_expenses"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_expenses_categoryId_idx" ON "pos_expenses"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_expenses_userId_idx" ON "pos_expenses"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_expenses_tenant_id_idx" ON "pos_expenses"("tenant_id");

