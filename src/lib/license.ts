// Sistema de Licencias MyeCommerce POS v2.9.55
// Genera y valida claves de licencia con algoritmo propietario
// Estructura: TRIAL (15 dias) | BASICA (365 dias) | PROFESIONAL (365 dias)

const LICENSE_SECRET = process.env.LICENSE_SECRET || "MYEC0MM3RC3-P0S-V3N3ZU3L4-2024-S3CR3T";
const LICENSE_SEED = 0x5A1F3E7B;

export interface LicenseInfo {
  isValid: boolean;
  licenseType: "trial" | "basica" | "profesional";
  machineId: string;
  licenseKey: string;
  activatedAt: string;
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
  maxProducts: number;
  maxDailySales: number;
  maxUsers: number;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerRif: string;
  features: LicenseFeatures;
  maxActivations: number;
  activationCount: number;
  previousMachines: string[];
  isSameMachine: boolean;
  machineMismatch: boolean;
  mismatchReason: string;
  blockedReason: string;
}

export interface LicenseFeatures {
  pos: boolean;
  products: boolean;
  categories: boolean;
  cashClosing: boolean;
  devolutions: boolean;
  basicReports: boolean;
  advancedReports: boolean;
  salesCharts: boolean;
  autoBackup: boolean;
  exportImport: boolean;
  noWatermark: boolean;
  unlimitedProducts: boolean;
  unlimitedSales: boolean;
  multipleUsers: boolean;
  inventoryAlerts: boolean;
  printInvoice: boolean;
  productDiscount: boolean;
  saleNotes: boolean;
  priceHistory: boolean;
  frequentCustomers: boolean;
  allowZeroStockConfig: boolean;
}

// =================== LIMITES POR PLAN v2.1 ===================
const LICENSE_LIMITS = {
  trial: {
    maxProducts: 30,
    maxDailySales: 15,
    maxUsers: 1,
    maxActivations: 1,
    defaultDays: 15,
    features: {
      pos: true,
      products: true,
      categories: true,
      cashClosing: false,
      devolutions: false,
      basicReports: true,
      advancedReports: false,
      salesCharts: false,
      autoBackup: false,
      exportImport: false,
      noWatermark: false,
      unlimitedProducts: false,
      unlimitedSales: false,
      multipleUsers: false,
      inventoryAlerts: false,
      printInvoice: false,
      productDiscount: false,
      saleNotes: false,
      priceHistory: false,
      frequentCustomers: false,
      allowZeroStockConfig: false,
    },
  },
  basica: {
    maxProducts: 300,
    maxDailySales: 99999,
    maxUsers: 1,
    maxActivations: 2,
    defaultDays: 365,
    features: {
      pos: true,
      products: true,
      categories: true,
      cashClosing: true,
      devolutions: true,
      basicReports: true,
      advancedReports: false,
      salesCharts: false,
      autoBackup: true,
      exportImport: true,
      noWatermark: true,
      unlimitedProducts: false,
      unlimitedSales: true,
      multipleUsers: false,
      inventoryAlerts: false,
      printInvoice: true,
      productDiscount: true,
      saleNotes: false,
      priceHistory: false,
      frequentCustomers: false,
      allowZeroStockConfig: true,
    },
  },
  profesional: {
    maxProducts: 99999,
    maxDailySales: 99999,
    maxUsers: 5,
    maxActivations: 3,
    defaultDays: 365,
    features: {
      pos: true,
      products: true,
      categories: true,
      cashClosing: true,
      devolutions: true,
      basicReports: true,
      advancedReports: true,
      salesCharts: true,
      autoBackup: true,
      exportImport: true,
      noWatermark: true,
      unlimitedProducts: true,
      unlimitedSales: true,
      multipleUsers: true,
      inventoryAlerts: true,
      printInvoice: true,
      productDiscount: true,
      saleNotes: true,
      priceHistory: true,
      frequentCustomers: true,
      allowZeroStockConfig: true,
    },
  },
};

// =================== GENERADOR DE CLAVES ===================
export function generateLicenseKey(
  licenseType: "basica" | "profesional",
  ownerName: string,
  machineId: string = "",
  days: number = 365,
  secret: string = LICENSE_SECRET
): string {
  const typeCode = licenseType === "profesional" ? "PR0" : "B4S";

  const now = new Date();
  const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const timeCode = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${expiry.getFullYear()}${String(expiry.getMonth() + 1).padStart(2, "0")}${String(expiry.getDate()).padStart(2, "0")}`;

  const nameHash = simpleHash(ownerName.toLowerCase().trim());
  const machineHash = machineId ? simpleHash(machineId) : simpleHash(licenseType + timeCode);

  const payload = `${typeCode}${timeCode}${nameHash}${machineHash}`;
  const checkDigit = computeCheckDigit(payload, secret);

  const raw = `${typeCode}${timeCode}${nameHash}${machineHash}${checkDigit}`;
  return formatKey(raw);
}

// =================== VALIDADOR DE CLAVES ===================

export function validateLicenseKey(
  licenseKey: string,
  machineId: string = "",
  secret: string = LICENSE_SECRET
): {
  valid: boolean;
  licenseType: "trial" | "basica" | "profesional";
  expiresAt: Date;
  activatedAt: Date;
  error?: string;
} {
  try {
    const clean = licenseKey.replace(/[^A-Z0-9]/gi, "").toUpperCase();

    if (clean.length < 20) {
      return { valid: false, licenseType: "trial", expiresAt: new Date(), activatedAt: new Date(), error: "Clave muy corta" };
    }

    let licenseType: "basica" | "profesional" = "basica";
    if (clean.startsWith("PR0")) {
      licenseType = "profesional";
    } else if (clean.startsWith("B4S")) {
      licenseType = "basica";
    } else {
      return { valid: false, licenseType: "trial", expiresAt: new Date(), activatedAt: new Date(), error: "Tipo de licencia no reconocido" };
    }

    if (clean.length >= 22) {
      const expiryStr = clean.substring(11, 19);
      const year = parseInt(expiryStr.substring(0, 4));
      const month = parseInt(expiryStr.substring(4, 6));
      const day = parseInt(expiryStr.substring(6, 8));

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return { valid: false, licenseType: "trial", expiresAt: new Date(), activatedAt: new Date(), error: "Fecha de expiracion invalida" };
      }

      const expiresAt = new Date(year, month - 1, day, 23, 59, 59);

      if (expiresAt < new Date()) {
        return { valid: false, licenseType, expiresAt, activatedAt: new Date(), error: "Licencia expirada" };
      }

      const actStr = clean.substring(3, 11);
      const aYear = parseInt(actStr.substring(0, 4));
      const aMonth = parseInt(actStr.substring(4, 6));
      const aDay = parseInt(actStr.substring(6, 8));
      const activatedAt = new Date(aYear, aMonth - 1, aDay);

      const lastFour = clean.substring(clean.length - 4);
      const expectedCheck = computeCheckDigit(clean.substring(0, clean.length - 4), secret);

      if (lastFour !== expectedCheck) {
        return { valid: false, licenseType, expiresAt, activatedAt, error: "Clave invalida - digito de verificacion incorrecto" };
      }

      return { valid: true, licenseType, expiresAt, activatedAt };
    }

    return { valid: false, licenseType: "trial", expiresAt: new Date(), activatedAt: new Date(), error: "Formato de clave invalido" };
  } catch (error) {
    return { valid: false, licenseType: "trial", expiresAt: new Date(), activatedAt: new Date(), error: "Error al validar clave" };
  }
}

// Obtener features segun tipo
export function getLicenseFeatures(licenseType: string): LicenseFeatures {
  return LICENSE_LIMITS[licenseType as keyof typeof LICENSE_LIMITS]?.features || LICENSE_LIMITS.trial.features;
}

// Obtener limites segun tipo
export function getLicenseLimits(licenseType: string) {
  const limits = LICENSE_LIMITS[licenseType as keyof typeof LICENSE_LIMITS];
  return {
    maxProducts: limits?.maxProducts ?? 30,
    maxDailySales: limits?.maxDailySales ?? 15,
    maxUsers: limits?.maxUsers ?? 1,
    maxActivations: limits?.maxActivations ?? 1,
    defaultDays: limits?.defaultDays ?? 15,
  };
}

// Obtener info completa del plan
export function getPlanInfo(licenseType: string) {
  const limits = LICENSE_LIMITS[licenseType as keyof typeof LICENSE_LIMITS];
  return {
    ...getLicenseLimits(licenseType),
    features: limits?.features || LICENSE_LIMITS.trial.features,
  };
}

// =================== FUNCIONES AUXILIARES ===================

function simpleHash(str: string): string {
  let hash = LICENSE_SEED;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(4, "0").slice(0, 4);
}

function computeCheckDigit(payload: string, secret: string): string {
  let hash = 0;
  const combined = payload + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 7) - hash + char) | 0;
    hash = hash ^ (hash >>> 16);
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(4, "0").slice(0, 4);
}

function formatKey(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const groups: string[] = [];
  for (let i = 0; i < clean.length; i += 5) {
    groups.push(clean.substring(i, i + 5));
  }
  return groups.join("-");
}

// Generar Machine ID simulado para testing
export function generateTestMachineId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "MCH-";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Features legibles para la UI
export const FEATURE_LABELS: Record<string, string> = {
  pos: "Punto de Venta (POS)",
  products: "Gestion de Productos",
  categories: "Categorias",
  cashClosing: "Cierre de Caja",
  devolutions: "Devoluciones",
  basicReports: "Reportes Basicos",
  advancedReports: "Reportes Avanzados",
  salesCharts: "Graficos de Ventas",
  autoBackup: "Respaldo Automatico",
  exportImport: "Exportar / Importar Datos",
  noWatermark: "Sin Marca de Agua",
  unlimitedProducts: "Productos Ilimitados",
  unlimitedSales: "Ventas Ilimitadas",
  multipleUsers: "Multiples Cajeros (Usuarios)",
  inventoryAlerts: "Alertas de Inventario / Stock Minimo",
  printInvoice: "Impresion de Factura",
  productDiscount: "Descuentos por Producto",
  saleNotes: "Notas en Ventas",
  priceHistory: "Historial de Precios",
  frequentCustomers: "Clientes Frecuentes",
  allowZeroStockConfig: "Configurar Venta con Stock en 0",
};
