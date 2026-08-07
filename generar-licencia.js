#!/usr/bin/env node
// ============================================================
// GENERADOR DE LICENCIAS MyeCommerce POS v2.9.16
// Uso: node generar-licencia.js [opciones]
// ============================================================

const readline = require('readline');

// =================== CONSTANTES (iguales a license.ts) ===================
const LICENSE_SECRET = "MYEC0MM3RC3-P0S-V3N3ZU3L4-2024-S3CR3T";
const LICENSE_SEED = 0x5A1F3E7B;

// =================== FUNCIONES (iguales a license.ts) ===================

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
  for (let i = 0; i < clean.length; i += 5) {
    groups.push(clean.substring(i, i + 5));
  }
  return groups.join("-");
}

function generateLicenseKey(licenseType, ownerName, machineId = "", days = 365, secret = LICENSE_SECRET) {
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

// =================== PLANOS ===================
const PLANOS = {
  basica: {
    nombre: "BASICA",
    productos: "300 max.",
    ventas: "Ilimitadas",
    cajeros: 1,
    activaciones: 2,
    duracion: "365 dias",
    dias: 365,
    precio: "Consultar",
    features: [
      "Punto de Venta (POS)", "Gestion de Productos", "Categorias",
      "Cierre de Caja", "Devoluciones", "Reportes Basicos",
      "Respaldo Automatico", "Exportar / Importar Datos",
      "Sin Marca de Agua", "Impresion de Factura",
      "Descuentos por Producto", "Venta con Stock en 0"
    ]
  },
  profesional: {
    nombre: "PROFESIONAL",
    productos: "Ilimitados",
    ventas: "Ilimitadas",
    cajeros: 5,
    activaciones: 3,
    duracion: "365 dias",
    dias: 365,
    precio: "Consultar",
    features: [
      "Punto de Venta (POS)", "Gestion de Productos", "Categorias",
      "Cierre de Caja", "Devoluciones", "Reportes Basicos",
      "Reportes Avanzados", "Graficos de Ventas",
      "Respaldo Automatico", "Exportar / Importar Datos",
      "Sin Marca de Agua", "Productos Ilimitados", "Ventas Ilimitadas",
      "Multiples Cajeros (5)", "Alertas de Inventario",
      "Impresion de Factura", "Descuentos por Producto",
      "Notas en Ventas", "Historial de Precios",
      "Clientes Frecuentes", "Venta con Stock en 0"
    ]
  }
};

// =================== INTERFAZ INTERACTIVA ===================
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pregunta(texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       GENERADOR DE LICENCIAS MyeCommerce POS v2.9.16    ║');
  console.log('║              (Administrador / Soporte)                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Verificar argumentos de línea de comandos
  const args = process.argv.slice(2);
  if (args.includes('--ayuda') || args.includes('--help') || args.includes('-h')) {
    mostrarAyuda();
    rl.close();
    return;
  }

  if (args.includes('--rapido')) {
    // Modo rapido con argumentos
    const idx = args.indexOf('--rapido');
    const tipo = args[idx + 1] || 'basica';
    const nombre = args[idx + 2] || 'Cliente';
    const machineId = args[idx + 3] || '';
    const dias = parseInt(args[idx + 4]) || 365;

    if (tipo !== 'basica' && tipo !== 'profesional') {
      console.log('ERROR: Tipo debe ser "basica" o "profesional"');
      rl.close();
      return;
    }

    const clave = generateLicenseKey(tipo, nombre, machineId, dias);
    const plano = PLANOS[tipo];
    const expira = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

    console.log(`Tipo: ${plano.nombre}`);
    console.log(`Nombre: ${nombre}`);
    console.log(`Dias: ${dias}`);
    console.log(`Expira: ${expira.toLocaleDateString('es-VE')}`);
    console.log(`Clave:  ${clave}`);
    console.log('');
    rl.close();
    return;
  }

  // Modo interactivo
  try {
    // Seleccionar tipo de licencia
    console.log('TIPOS DE LICENCIA DISPONIBLES:');
    console.log('  1) BASICA      - 300 productos, 1 cajero, 2 activaciones');
    console.log('  2) PROFESIONAL - Productos ilimitados, 5 cajeros, 3 activaciones');
    console.log('');

    const tipoResp = await pregunta('Seleccione el tipo de licencia [1/2]: ');
    const tipo = tipoResp.trim() === '2' ? 'profesional' : 'basica';
    const plano = PLANOS[tipo];

    console.log('');
    console.log(`> Licencia seleccionada: ${plano.nombre}`);

    // Nombre del propietario
    const nombre = (await pregunta('Nombre del propietario o negocio: ')).trim() || 'Cliente';
    console.log(`> Propietario: ${nombre}`);

    // Machine ID (opcional)
    console.log('');
    console.log('NOTA: El Machine ID vincula la licencia a una computadora especifica.');
    console.log('Si lo deja VACIO, la licencia funcionara en CUALQUIER equipo');
    console.log('(el cliente debera activarla manualmente en su equipo).');
    console.log('');
    const machineId = (await pregunta('Machine ID del equipo [Enter para omitir]: ')).trim();

    // Duración
    console.log('');
    const diasResp = (await pregunta(`Duracion en dias [Enter para ${plano.dias} por defecto]: `)).trim();
    const dias = parseInt(diasResp) || plano.dias;

    // Generar la clave
    const clave = generateLicenseKey(tipo, nombre, machineId, dias);
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);

    console.log('');
    console.log('══════════════════════════════════════════════════════════');
    console.log('              LICENCIA GENERADA EXITOSAMENTE              ');
    console.log('══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Tipo de Licencia:  ${plano.nombre}`);
    console.log(`  Propietario:       ${nombre}`);
    console.log(`  Fecha Generacion:  ${ahora.toLocaleDateString('es-VE')} ${ahora.toLocaleTimeString('es-VE')}`);
    console.log(`  Fecha Expiracion:  ${expira.toLocaleDateString('es-VE')}`);
    console.log(`  Duracion:          ${dias} dias`);
    console.log(`  Max Productos:     ${plano.productos}`);
    console.log(`  Max Ventas/Dia:    ${plano.ventas}`);
    console.log(`  Cajeros:           ${plano.cajeros}`);
    console.log(`  Activaciones:      ${plano.activaciones}`);
    if (machineId) {
      console.log(`  Machine ID:        ${machineId} (VINCULADA)`);
    } else {
      console.log(`  Machine ID:        No especificada (LIBRE)`);
    }
    console.log('');
    console.log('  ╔════════════════════════════════════════════════════╗');
    console.log(`  ║  CLAVE DE LICENCIA:                               ║`);
    console.log(`  ║                                                    ║`);
    console.log(`  ║  ${clave.padEnd(49)}║`);
    console.log(`  ║                                                    ║`);
    console.log('  ╚════════════════════════════════════════════════════╝');
    console.log('');

    // Instrucciones para el cliente
    console.log('INSTRUCCIONES PARA EL CLIENTE:');
    console.log('  1. Abra MyeCommerce POS en su computadora');
    console.log('  2. Vaya a la pestana "Licencia"');
    console.log('  3. Haga clic en "Activar / Renovar Licencia"');
    console.log('  4. Pegue la clave que aparece arriba');
    console.log('  5. Complete los datos del propietario (opcional)');
    console.log('  6. Haga clic en "Activar Licencia"');
    console.log('');

    // Preguntar si quiere generar otra
    const otra = await pregunta('Desea generar otra licencia? [s/N]: ');
    if (otra.trim().toLowerCase() === 's') {
      console.log('');
      main();
    } else {
      console.log('');
      console.log('Gracias por usar MyeCommerce POS License Generator');
      console.log('');
      rl.close();
    }
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
  }
}

function mostrarAyuda() {
  console.log('');
  console.log('USO:');
  console.log('  node generar-licencia.js                    Modo interactivo (guiado paso a paso)');
  console.log('  node generar-licencia.js --rapido           Modo rapido con valores por defecto');
  console.log('  node generar-licencia.js --help             Mostrar esta ayuda');
  console.log('');
  console.log('MODO RAPIDO:');
  console.log('  node generar-licencia.js --rapido <tipo> <nombre> [machineId] [dias]');
  console.log('');
  console.log('  Parametros:');
  console.log('    tipo       "basica" o "profesional" (obligatorio)');
  console.log('    nombre     Nombre del propietario (obligatorio)');
  console.log('    machineId  Machine ID del equipo (opcional)');
  console.log('    dias       Duracion en dias (por defecto: 365)');
  console.log('');
  console.log('  Ejemplos:');
  console.log('    node generar-licencia.js --rapido basica "Mi Negocio"');
  console.log('    node generar-licencia.js --rapido profesional "Tienda ABC" "MCH-A1B2C3D4-E5F6G7H8"');
  console.log('    node generar-licencia.js --rapido basica "Cliente 1" "" 180');
  console.log('');
  console.log('FORMATO DE CLAVE:');
  console.log('  Las claves tienen el formato: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX');
  console.log('  - BASICA:      Comienza con B4S...');
  console.log('  - PROFESIONAL: Comienza con PR0...');
  console.log('  - TRIAL:       Se genera automaticamente (15 dias, sin clave)');
  console.log('');
  console.log('PLANOS:');
  console.log('  BASICA:');
  console.log('    - 300 productos, 1 cajero, 2 activaciones');
  console.log('    - Cierre de caja, devoluciones, respaldo, factura, descuentos');
  console.log('');
  console.log('  PROFESIONAL:');
  console.log('    - Productos ilimitados, 5 cajeros, 3 activaciones');
  console.log('    - Todo lo de BASICA + reportes avanzados, graficos,');
  console.log('      alertas de inventario, historial de precios, clientes');
  console.log('');
}

// Ejecutar
main();
