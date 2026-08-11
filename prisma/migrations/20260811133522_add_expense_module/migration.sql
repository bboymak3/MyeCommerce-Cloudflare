-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "categoryId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "storeLogo" TEXT NOT NULL DEFAULT '',
    "businessType" TEXT NOT NULL DEFAULT 'general',
    "taxMode" TEXT NOT NULL DEFAULT 'included',
    "promoActive" BOOLEAN NOT NULL DEFAULT true,
    "promoLabel" TEXT NOT NULL DEFAULT 'PRECIO EXCLUSIVO',
    "promoOldPrice" REAL NOT NULL DEFAULT 280,
    "promoCurrentPrice" REAL NOT NULL DEFAULT 180,
    "promoExpiryDate" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Devolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "totalUsd" REAL NOT NULL,
    "totalBs" REAL NOT NULL,
    "exchangeRate" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completada',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Devolution_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DevolutionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "devolutionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "DevolutionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DevolutionItem_devolutionId_fkey" FOREIGN KEY ("devolutionId") REFERENCES "Devolution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
CREATE TABLE "CashClosing" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
CREATE TABLE "RoleConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleName" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rif" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "number" TEXT NOT NULL DEFAULT '',
    "supplierId" TEXT,
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "exchangeRate" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComboItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "comboId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ComboItem_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ComboItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "CreditPayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CreditPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'receipt',
    "color" TEXT NOT NULL DEFAULT '#ef4444',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_docNumber_key" ON "Client"("docNumber");

-- CreateIndex
CREATE INDEX "Client_docNumber_idx" ON "Client"("docNumber");

-- CreateIndex
CREATE INDEX "Client_fullName_idx" ON "Client"("fullName");

-- CreateIndex
CREATE INDEX "Client_type_idx" ON "Client"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_invoiceNumber_key" ON "Sale"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Sale_date_idx" ON "Sale"("date");

-- CreateIndex
CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");

-- CreateIndex
CREATE INDEX "Devolution_date_idx" ON "Devolution"("date");

-- CreateIndex
CREATE INDEX "Devolution_saleId_idx" ON "Devolution"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "License_machineId_key" ON "License"("machineId");

-- CreateIndex
CREATE INDEX "CashClosing_date_idx" ON "CashClosing"("date");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RoleConfig_roleName_key" ON "RoleConfig"("roleName");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Purchase_date_idx" ON "Purchase"("date");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX "CreditPayment_date_idx" ON "CreditPayment"("date");

-- CreateIndex
CREATE INDEX "CreditPayment_saleId_idx" ON "CreditPayment"("saleId");

-- CreateIndex
CREATE INDEX "CreditPayment_clientId_idx" ON "CreditPayment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE INDEX "Expense_userId_idx" ON "Expense"("userId");
