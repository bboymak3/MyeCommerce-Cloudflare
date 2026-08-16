"use client";

// ─── Product & Cart ───────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  granMayorPrice: number;
  isGranMayor: boolean;
  cost: number;
  stock: number;
  minStock: number;
  barcode: string;
  icon: string;
  image: string;
  noStock: boolean;
  vendePorPeso?: boolean;
  unidadPeso?: string;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  taxType?: string;
}

export interface CartItem extends Product {
  quantity: number;
  total: number;
  isWholesale: boolean;
  pesoIngresado?: boolean;
}

// ─── Client ──────────────────────────────────────────────────────
export interface ClientData {
  id: string;
  type: string;
  docType: string;
  docNumber: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  isFinalClient: boolean;
  creditBalance?: number;
  creditLimit?: number;
}

// ─── Held / Suspended Sale ────────────────────────────────────────
export interface HeldSaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxType: string;
}
export interface HeldSaleData {
  items: HeldSaleItem[];
  clientName: string;
  clientId: string | null;
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  totalBs: number;
  exchangeRate: number;
  paymentMethod: string;
  notes: string;
  sellerName: string;
  sellerRole: string;
}

// ─── Mixed Payment Entry ───────────────────────────────────────────
export interface MixedEntry {
  method: string;
  amountBs: number;
  amountUsd: number;
  reference: string;
}

// ─── POS Tab Props ────────────────────────────────────────────────
export interface PosTabProps {
  products: Product[];
  bcvRate: number;
  euroUsdtRate: number;
  taxRate: number;
  storeName: string;
  storeAddress: string;
  storeRif: string;
  storePhone: string;
  currency: string;
  allowZeroStock?: boolean;
  enableDiscount?: boolean;
  maxDiscountPct?: number;
  canSaleNotes?: boolean;
  canFrequentCustomers?: boolean;
  sellerName?: string;
  sellerRole?: string;
  ticketFontSize?: number;
  ticketFontFamily?: string;
  ticketHeaderMsg?: string;
  ticketFooterMsg?: string;
  ticketShowPhone?: boolean;
  ticketShowSeller?: boolean;
  ticketShowExchange?: boolean;
  ticketShowSlogan?: boolean;
  ticketShowCashReceived?: boolean;
  ticketShowLogo?: boolean;
  ticketBold?: boolean;
  ticketPaperWidth?: string;
  ticketMarginLeft?: number;
  ticketMarginRight?: number;
  ticketUseAgent?: boolean;
  ticketAgentUrl?: string;
  ticketCurrencyMode?: string;
  storeLogo?: string;
  businessType?: string;
  taxMode?: string;
  onSaleComplete?: () => void;
  onHoldSale?: (data: HeldSaleData) => void | Promise<void>;
  initialCart?: CartItem[] | null;
  initialClient?: ClientData | null;
  initialNotes?: string;
  initialDiscount?: number;
  initialPaymentMethod?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────
export const USD_METHODS = ["zelle", "usdt", "efectivo-usd"] as const;
export const REF_REQUIRED_METHODS = ["transferencia", "pago-movil", "zelle", "usdt", "mixto"] as const;

export const METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo (Bs)",
  "efectivo-usd": "Efectivo ($)",
  transferencia: "Transferencia",
  "pago-movil": "Pago Movil",
  "punto-de-venta": "Punto de Venta",
  cashea: "Cashea",
  zelle: "Zelle ($)",
  usdt: "USDT ($)",
};

export function getRefPlaceholder(method: string) {
  const m = method.toLowerCase();
  if (m === "zelle") return "Nombre titular / Email";
  if (m === "usdt") return "Email o ID transferencia";
  return "Ej: 12345678901234567890";
}

export function getRefLabel(method: string) {
  const m = method.toLowerCase();
  if (m === "zelle") return "Nombre Titular (email/tel opcional)";
  if (m === "usdt") return "Email o ID de Transferencia";
  return "Numero de Referencia";
}

export const DEFAULT_MIXED_PAYMENTS: MixedEntry[] = [
  { method: "efectivo", amountBs: 0, amountUsd: 0, reference: "" },
  { method: "pago-movil", amountBs: 0, amountUsd: 0, reference: "" },
];
