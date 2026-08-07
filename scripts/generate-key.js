#!/usr/bin/env node
/**
 * ============================================
 *  GENERADOR DE LICENCIAS - MyeCommerce POS v2.1
 * ============================================
 *
 *  USO:
 *    node scripts/generate-key.js BASICA "Nombre del Cliente"
 *    node scripts/generate-key.js PROFESIONAL "Nombre del Cliente"
 *    node scripts/generate-key.js BASICA "Nombre" --days 180
 *    node scripts/generate-key.js PROFESIONAL "Nombre" --machine MCH-ABC123
 *    node scripts/generate-key.js BASICA "Nombre" --rif "J-00000000-0"
 *
 *  EJEMPLO:
 *    node scripts/generate-key.js PROFESIONAL "Tienda Don Pedro"
 *    node scripts/generate-key.js BASICA "Abastos Caracas" --days 365
 */

const LICENSE_SECRET = "MYEC0MM3RC3-P0S-V3N3ZU3L4-2024-S3CR3T";
const LICENSE_SEED = 0x5A1F3E7B;

function simpleHash(str) {
  let hash = LICENSE_SEED;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(4, "0").slice(0, 4);
}

function computeCheckDigit(payload, secret) {
  let hash = 0;
  const combined = payload + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 7) - hash + char) | 0;
    hash = hash ^ (hash >>> 16);
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(4, "0").slice(0, 4);
}

function formatKey(raw) {
  const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const groups = [];
  for (let i = 0; i < clean.length && groups.length < 5; i += 5) {
    groups.push(clean.substring(i, i + 5));
  }
  return groups.join("-");
}

function generateLicenseKey(licenseType, ownerName, machineId, days) {
  const typeCode = licenseType === "profesional" ? "PR0" : "B4S";
  const now = new Date();
  const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const timeCode =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    expiry.getFullYear().toString() +
    String(expiry.getMonth() + 1).padStart(2, "0") +
    String(expiry.getDate()).padStart(2, "0");
  const nameHash = simpleHash(ownerName.toLowerCase().trim());
  const machineHash = machineId
    ? simpleHash(machineId)
    : simpleHash(licenseType + timeCode);
  const payload = typeCode + timeCode + nameHash + machineHash;
  const checkDigit = computeCheckDigit(payload, LICENSE_SECRET);
  const raw = typeCode + timeCode + nameHash + machineHash + checkDigit;
  return {
    key: formatKey(raw),
    type: licenseType,
    owner: ownerName,
    activatedAt: now.toLocaleDateString("es-VE"),
    expiresAt: expiry.toLocaleDateString("es-VE"),
    days,
  };
}

// Plan features info
const PLAN_INFO = {
  basica: {
    maxProducts: 300,
    maxDailySales: "Ilimitadas",
    maxUsers: 1,
    maxActivations: 2,
    features: [
      "Punto de Venta (POS)", "Gestion de Productos", "Categorias",
      "Cierre de Caja", "Devoluciones", "Reportes Basicos",
      "Respaldo Automatico", "Exportar/Importar", "Impresion de Factura",
      "Descuentos por Producto", "Venta con Stock en 0", "Sin Marca de Agua",
    ],
  },
  profesional: {
    maxProducts: "Ilimitados",
    maxDailySales: "Ilimitadas",
    maxUsers: 5,
    maxActivations: 3,
    features: [
      "TODO lo de BASICA +",
      "Reportes Avanzados", "Graficos de Ventas", "Multiples Cajeros (5)",
      "Alertas de Inventario", "Notas en Ventas", "Historial de Precios",
      "Clientes Frecuentes",
    ],
  },
};

// =================== MAIN ===================
const args = process.argv.slice(2);

console.log("");
console.log("====================================================");
console.log("   GENERADOR DE LICENCIAS - MyeCommerce POS v2.1");
console.log("====================================================");
console.log("");

if (args.length < 2) {
  console.log("USO:");
  console.log("  node scripts/generate-key.js <TIPO> <NOMBRE> [opciones]");
  console.log("");
  console.log("TIPOS:");
  console.log("  BASICA       - Licencia Basica (hasta 300 productos)");
  console.log("  PROFESIONAL  - Licencia Profesional (sin limites)");
  console.log("");
  console.log("OPCIONES:");
  console.log("  --days NNN    - Duracion en dias (default: 365)");
  console.log("  --machine XX  - Machine ID especifica");
  console.log("  --rif XX      - RIF del propietario");
  console.log("");
  console.log("EJEMPLOS:");
  console.log('  node scripts/generate-key.js PROFESIONAL "Tienda Don Pedro"');
  console.log('  node scripts/generate-key.js BASICA "Abastos Caracas" --days 365');
  console.log('  node scripts/generate-key.js BASICA "Mi Bodega" --machine MCH-A1B2C3D4-E5F6G7H8');
  console.log("");
  process.exit(0);
}

const licenseType = args[0].toLowerCase();
const ownerName = args[1];

if (licenseType !== "basica" && licenseType !== "profesional") {
  console.log("ERROR: Tipo debe ser BASICA o PROFESIONAL");
  process.exit(1);
}

let days = 365;
let machineId = "";
let rif = "";

for (let i = 2; i < args.length; i++) {
  if (args[i] === "--days" && args[i + 1]) { days = parseInt(args[i + 1]); i++; }
  if (args[i] === "--machine" && args[i + 1]) { machineId = args[i + 1]; i++; }
  if (args[i] === "--rif" && args[i + 1]) { rif = args[i + 1]; i++; }
}

if (isNaN(days) || days < 1 || days > 3650) {
  console.log("ERROR: Los dias deben estar entre 1 y 3650");
  process.exit(1);
}

const result = generateLicenseKey(licenseType, ownerName, machineId, days);
const plan = PLAN_INFO[licenseType];

console.log("----------------------------------------------------");
console.log("  LICENCIA GENERADA EXITOSAMENTE");
console.log("----------------------------------------------------");
console.log("");
console.log("  Tipo:           " + (result.type === "profesional" ? "PROFESIONAL" : "BASICA"));
console.log("  Propietario:    " + result.owner);
if (rif) console.log("  RIF:            " + rif);
console.log("  Activacion:     " + result.activatedAt);
console.log("  Expiracion:     " + result.expiresAt);
console.log("  Duracion:       " + result.days + " dias");
console.log("");
console.log("  === CLAVE DE LICENCIA ===");
console.log("");
console.log("  " + result.key);
console.log("");
console.log("  ==========================");
console.log("");
console.log("  --- Datos del Plan ---");
console.log("  Productos max.:  " + plan.maxProducts);
console.log("  Ventas/dia:      " + plan.maxDailySales);
console.log("  Cajeros:         " + plan.maxUsers);
console.log("  Activaciones:    " + plan.maxActivations);
console.log("");
console.log("  --- Funciones Incluidas ---");
plan.features.forEach(f => console.log("  + " + f));
console.log("");

if (machineId) {
  console.log("  NOTA: Esta clave esta vinculada al Machine ID: " + machineId);
  console.log("");
}

console.log("----------------------------------------------------");
console.log("");
