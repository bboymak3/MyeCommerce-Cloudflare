/**
 * escpos-buffer.ts — ESC/POS Buffer Generator v2.0 (MyeCommerce POS v2.9.16)
 *
 * REGLA CRITICA: cmdSize(0x01) o (0x11) duplica el ANCHO de cada caracter.
 *   - En 58mm (32 chars normales), con doble ancho solo caben 16 chars por linea.
 *   - En 80mm (48 chars normales), con doble ancho solo caben 24 chars por linea.
 *   - Cualquier linea en doble ancho que supere estos limitos DESBORDA y monta texto.
 *
 * Por eso:
 *   - Nombre tienda (doble ancho): se trunca/centra en maxChars/2
 *   - TOTAL (doble ancho): se formatea para caber en maxChars/2
 *   - Tabla de items: SIEMPRE en tamaño normal, sin doble ancho
 *   - CREDITO badge: SIEMPRE en tamaño normal
 */

// ─── Caracteres por ancho de papel ────────────────────────────────
export const PAPER_CHARS: Record<string, number> = {
  '55mm': 32,
  '57mm': 32,
  '58mm': 32,
  '80mm': 48,
};

// ─── Tipos ──────────────────────────────────────────────────────
export interface EscposReceipt {
  id: string;
  date: string | Date;
  subtotal: number;
  taxAmount?: number;
  discount: number;
  total: number;
  totalBs: number;
  exchangeRate: number;
  paymentMethod: string;
  referenceNumber?: string;
  mixedPaymentJson?: string;
  customerName?: string;
  clientDocType?: string;
  clientDocNumber?: string;
  clientName?: string;
  clientAddress?: string;
  sellerName?: string;
  isCredit?: boolean;
  creditDays?: number;
  creditDueDate?: string | Date;
  cashReceived?: number;
  vuelto?: number;
  items?: any[];
}

export interface EscposSettings {
  storeName: string;
  storeRif: string;
  storeAddress: string;
  storePhone: string;
  ticketShowPhone: boolean;
  ticketShowSeller: boolean;
  ticketShowExchange: boolean;
  ticketCurrencyMode?: string;
  ticketShowSlogan: boolean;
  ticketPaperWidth: string;
  ticketHeaderMsg: string;
  ticketFooterMsg: string;
  storeLogo?: string;
  businessType?: string;
}

// ─── Etiquetas de metodos de pago ────────────────────────────────
const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo (Bs)',
  'efectivo-usd': 'Efectivo ($)',
  transferencia: 'Transferencia',
  'pago-movil': 'Pago Movil',
  'punto-de-venta': 'Punto de Venta',
  cashea: 'Cashea',
  zelle: 'Zelle ($)',
  usdt: 'USDT ($)',
};

// ─── Utilidades de texto ─────────────────────────────────────────
function padL(s: string, len: number): string {
  if (s.length >= len) return s;
  return ' '.repeat(len - s.length) + s;
}

function padR(s: string, len: number): string {
  if (s.length >= len) return s;
  return s + ' '.repeat(len - s.length);
}

function centerText(s: string, len: number): string {
  if (s.length >= len) return s;
  const total = len - s.length;
  const left = Math.floor(total / 2);
  return ' '.repeat(left) + s + ' '.repeat(total - left);
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.substring(0, maxLen) : s;
}

function fmtN(n: number): string {
  const s = n.toFixed(2).replace('.', ',');
  if (s.endsWith(',00')) return s.slice(0, -3);
  return s;
}

// ─── Columnas dinamicas ──────────────────────────────────────────
interface ColWidths {
  cantW: number;
  priceW: number;
  totalW: number;
  nameW: number;
}

function calcColumnWidths(items: any[], maxChars: number): ColWidths {
  let maxQty = 0, maxPrice = 0, maxTotal = 0;
  for (const item of items) {
    const qty = item.quantity || 0;
    const unit = item.product?.vendePorPeso ? (' ' + (item.product.unidadPeso || 'kg')) : '';
    const qtyStr = qty % 1 === 0 ? String(qty) + unit : qty.toFixed(2) + unit;
    const priceStr = fmtN(item.unitPrice || 0);
    const totalStr = fmtN(item.total || 0);

    if (qtyStr.length > maxQty) maxQty = qtyStr.length;
    if (priceStr.length > maxPrice) maxPrice = priceStr.length;
    if (totalStr.length > maxTotal) maxTotal = totalStr.length;
  }
  // CANT: minimo 3 + 3 espacios (padding extra entre columnas)
  let cantW = Math.max(maxQty, 3) + 3;
  // P.UNI: minimo 4 + 3 espacios
  let priceW = Math.max(maxPrice, 4) + 3;
  // TOTAL: minimo 6, sin espacio extra (es la ultima columna)
  let totalW = Math.max(maxTotal, 6);

  // SEGURIDAD: garantizar que las columnas numericas + nombre no excedan maxChars
  const minNameW = 6;
  const maxNumeric = maxChars - minNameW;
  if (cantW + priceW + totalW > maxNumeric) {
    // Reducir proporcionalmente las columnas numericas
    const totalNumeric = cantW + priceW + totalW;
    const scale = maxNumeric / totalNumeric;
    cantW = Math.max(Math.round(cantW * scale), 4);
    priceW = Math.max(Math.round(priceW * scale), 5);
    totalW = Math.max(Math.round(totalW * scale), 5);
    // Ajuste final: si aun sobra, reducir priceW
    const diff = cantW + priceW + totalW - maxNumeric;
    if (diff > 0) {
      priceW = Math.max(priceW - diff, 5);
    }
  }
  // PRODUCTO: lo que sobra (minimo 6)
  const nameW = Math.max(maxChars - cantW - priceW - totalW, 6);
  return { cantW, priceW, totalW, nameW };
}

// ─── Wrapping de nombres ────────────────────────────────────────
function wrapName(name: string, maxW: number): string[] {
  if (!name || name.length <= maxW) return [padR(name || '', maxW)];
  const lines: string[] = [];
  let rem = name;
  while (rem.length > 0) {
    if (rem.length <= maxW) {
      lines.push(padR(rem, maxW));
      rem = '';
    } else {
      let brk = rem.lastIndexOf(' ', maxW);
      if (brk <= 0) brk = maxW;
      lines.push(padR(rem.substring(0, brk), maxW));
      rem = rem.substring(brk).trimStart();
    }
  }
  return lines;
}

// ─── ESC/POS Command helpers (browser Uint8Array) ────────────────
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

function concatArrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function cmdInit(): Uint8Array { return new Uint8Array([ESC, 0x40]); }
function cmdAlign(n: 0 | 1 | 2): Uint8Array { return new Uint8Array([ESC, 0x61, n]); }
function cmdBold(on: boolean): Uint8Array { return new Uint8Array([ESC, 0x45, on ? 1 : 0]); }
function cmdSize(n: number): Uint8Array { return new Uint8Array([GS, 0x21, n]); }
function cmdFeed(n: number): Uint8Array { return new Uint8Array([ESC, 0x64, n]); }
function cmdCut(): Uint8Array { return new Uint8Array([GS, 0x56, 0x01, 0x00]); }

// Convertir string ASCII a Uint8Array
function text(s: string): Uint8Array {
  const cleaned = s
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ');
  const arr = new Uint8Array(cleaned.length);
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    arr[i] = code > 127 ? 63 : code;
  }
  return arr;
}

function textLine(s: string): Uint8Array {
  return concatArrays(text(s), new Uint8Array([LF]));
}

function separatorLine(maxChars: number, ch: string = '-'): Uint8Array {
  return textLine(ch.repeat(maxChars));
}

function doubleLine(maxChars: number): Uint8Array {
  return textLine('='.repeat(maxChars));
}

// ─── Base64 ─────────────────────────────────────────────────────
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ═══════════════════════════════════════════════════════════════════
// GENERADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function generateEscposBuffer(params: {
  receipt: EscposReceipt;
  settings: EscposSettings;
  currency?: string;
  defaultSellerName?: string;
}): Uint8Array {
  const { receipt, settings, currency = 'USD', defaultSellerName = '' } = params;

  const d = new Date(receipt.date);
  const dateStr = d.toLocaleDateString('es-VE');
  const timeStr = d.toLocaleTimeString('es-VE');

  const {
    storeName, storeRif, storeAddress, storePhone,
    ticketShowPhone, ticketShowSeller, ticketShowExchange, ticketShowSlogan,
    ticketPaperWidth, ticketHeaderMsg, ticketFooterMsg,
    ticketCurrencyMode = 'dual',
    storeLogo, businessType,
  } = settings;

  const maxChars = PAPER_CHARS[ticketPaperWidth] || PAPER_CHARS['58mm'];
  // CRITICO: caracteres disponibles cuando se usa DOBLE ANCHO
  const halfChars = Math.floor(maxChars / 2);

  // Modo de moneda para precios y totales
  const cMode = ticketCurrencyMode || 'dual';
  const exRate = receipt.exchangeRate || 1;
  // Determinar moneda para precios unitarios y totales de articulo
  const useBsUnit = (cMode === 'bs_only' || cMode === 'unit_bs_total_usd');
  const useUsdUnit = (cMode === 'usd_only' || cMode === 'unit_usd_total_bs');
  // Determinar moneda para TOTAL final
  const useBsTotal = (cMode === 'bs_only' || cMode === 'unit_usd_total_bs');
  const useUsdTotal = (cMode === 'usd_only' || cMode === 'unit_bs_total_usd');

  // Pago
  const isCreditSale = receipt.isCredit === true;
  const payLabel = isCreditSale
    ? 'CREDITO'
    : (receipt.paymentMethod === 'mixto' ? 'Mixto' : PAYMENT_LABELS[receipt.paymentMethod] || receipt.paymentMethod);

  let mixedBreakdown = '';
  if (receipt.paymentMethod === 'mixto' && receipt.mixedPaymentJson) {
    try {
      const entries = JSON.parse(receipt.mixedPaymentJson);
      mixedBreakdown = entries.map((e: any) =>
        `${PAYMENT_LABELS[e.method] || e.method}: ${parseFloat(e.amountBs).toFixed(2)}Bs`
      ).join(' | ');
    } catch { /* ignore */ }
  }

  // Cliente
  const clientName = receipt.clientName || receipt.customerName || '';
  const isFinalClient = !clientName || clientName === 'CLIENTE FINAL' || clientName === 'Consumidor Final';

  const parts: Uint8Array[] = [];

  // ═══ INICIALIZAR IMPRESORA ═══
  parts.push(cmdInit());
  parts.push(cmdFeed(1));

  // ═══ LOGO / ICONO DEL NEGOCIO ═══
  // Las impresoras termicas ESC/POS no soportan emojis nativamente.
  // Si hay un logo subido, se indica con [LOGO] como placeholder.
  // El agente de impresion puede ser extendido para soportar bitmaps.
  if (storeLogo) {
    parts.push(cmdAlign(1));
    parts.push(textLine('[LOGO]'));
    parts.push(cmdAlign(0));
  } else {
    // Sin logo: imprimir indicador del tipo de negocio
    const typeLabels: Record<string, string> = {
      general: '* MI TIENDA *', panaderia: '* PANADERIA *', pasteleria: '* PASTELERIA *',
      carniceria: '* CARNICERIA *', farmacia: '* FARMACIA *', supermercado: '* SUPERMERCADO *',
      restaurante: '* RESTAURANTE *', cafe: '* CAFE *', ferreteria: '* FERRETERIA *',
      ropa: '* ROPA *', zapateria: '* ZAPATERIA *', optica: '* OPTICA *',
      licoreria: '* LICORERIA *', beauty: '* BELLEZA *', veterinaria: '* VETERINARIA *',
      papelera: '* PAPELERIA *',
    };
    const typeLabel = typeLabels[businessType || 'general'] || '* MI TIENDA *';
    parts.push(cmdAlign(1));
    parts.push(cmdBold(true));
    parts.push(textLine(centerText(typeLabel, maxChars)));
    parts.push(cmdBold(false));
    parts.push(cmdAlign(0));
  }

  // ═══ NOMBRE TIENDA — Doble alto + doble ancho ═══
  // Con doble ancho, solo caben halfChars caracteres por linea
  parts.push(cmdAlign(1)); // centrado
  parts.push(cmdBold(true));
  parts.push(cmdSize(0x11)); // doble alto + doble ancho
  {
    const name = storeName || 'Mi Tienda';
    // Truncar a halfChars por linea
    if (name.length <= halfChars) {
      parts.push(textLine(centerText(name, halfChars)));
    } else {
      // Si el nombre es mas largo, cortarlo en lineas de halfChars
      for (let i = 0; i < name.length; i += halfChars) {
        parts.push(textLine(name.substring(i, i + halfChars)));
      }
    }
  }
  parts.push(cmdSize(0x00)); // RESTAURAR TAMANO NORMAL
  parts.push(cmdBold(false));

  // RIF, direccion, telefono — tamano normal
  if (storeRif) parts.push(textLine('RIF: ' + storeRif));
  if (storeAddress) {
    // Wrap direccion si es muy larga
    if (storeAddress.length > maxChars) {
      const addrLines = wrapText(storeAddress, maxChars);
      for (const l of addrLines) parts.push(textLine(l));
    } else {
      parts.push(textLine(storeAddress));
    }
  }
  if (ticketShowPhone && storePhone) parts.push(textLine('Tel: ' + storePhone));

  if (ticketHeaderMsg) {
    parts.push(cmdBold(true));
    parts.push(textLine(ticketHeaderMsg));
    parts.push(cmdBold(false));
  }

  parts.push(cmdAlign(0)); // izquierda
  parts.push(doubleLine(maxChars));

  // ═══ INFO VENTA — tamano normal ═══
  parts.push(textLine('Fecha: ' + dateStr + ' ' + timeStr));
  // Número de factura / correlativo
  const invoiceNumber = (receipt as any).invoiceNumber || '';
  if (invoiceNumber) {
    parts.push(cmdBold(true));
    parts.push(textLine('FACTURA DE VENTA'));
    parts.push(textLine('N. ' + invoiceNumber));
    parts.push(cmdBold(false));
  }

  if (!isFinalClient) {
    parts.push(cmdBold(true));
    parts.push(textLine(truncate('Cliente: ' + clientName, maxChars)));
    parts.push(cmdBold(false));
    if (receipt.clientDocNumber) {
      parts.push(textLine('CI/RIF: ' + (receipt.clientDocType || 'V') + '-' + receipt.clientDocNumber));
    }
    if (receipt.clientAddress) {
      parts.push(textLine(truncate(receipt.clientAddress, maxChars)));
    }
  } else {
    parts.push(cmdBold(true));
    parts.push(textLine('Cliente: Consumidor Final'));
    parts.push(cmdBold(false));
  }

  parts.push(separatorLine(maxChars));

  // ═══ CREDITO — tamano normal (SIN doble ancho) ═══
  if (isCreditSale) {
    parts.push(cmdAlign(1));
    parts.push(cmdBold(true));
    // Sin cmdSize — tamano normal, solo negrita y centrado
    parts.push(textLine('*** CREDITO ***'));
    parts.push(cmdBold(false));
    parts.push(cmdAlign(0));

    const due = receipt.creditDueDate ? new Date(receipt.creditDueDate) : null;
    const dueStr = due ? due.toLocaleDateString('es-VE') : '';
    parts.push(textLine('Plazo: ' + (receipt.creditDays || 30) + 'd' + (dueStr ? ' Vence: ' + dueStr : '')));
  }

  // ═══ METODO DE PAGO — tamano normal ═══
  parts.push(cmdBold(true));
  parts.push(textLine('Pago: ' + payLabel));
  parts.push(cmdBold(false));
  if (!isCreditSale && receipt.referenceNumber) {
    parts.push(textLine('Ref: ' + String(receipt.referenceNumber)));
  }
  if (!isCreditSale && mixedBreakdown) {
    if (mixedBreakdown.length > maxChars) {
      const words = mixedBreakdown.split(' | ');
      let line = '';
      for (const w of words) {
        if ((line + ' | ' + w).length > maxChars) {
          if (line) parts.push(textLine(line));
          line = w;
        } else {
          line = line ? line + ' | ' + w : w;
        }
      }
      if (line) parts.push(textLine(line));
    } else {
      parts.push(textLine(mixedBreakdown));
    }
  }
  if (ticketShowSeller && (receipt.sellerName || defaultSellerName)) {
    parts.push(cmdBold(true));
    parts.push(textLine('Vend: ' + (receipt.sellerName || defaultSellerName || '')));
    parts.push(cmdBold(false));
  }

  parts.push(separatorLine(maxChars));

  // ═══ TABLA DE ITEMS — SIEMPRE tamano normal ═══
  // Orden: CANT | PRODUCTO | P.UNI | TOTAL
  const items = receipt.items || [];
  const cols = calcColumnWidths(items, maxChars);

  // safeNameW ya garantizado por calcColumnWidths
  const safeNameW = cols.nameW;

  const headerLine = padR('PRODUCTO', safeNameW) + padL('CANT', cols.cantW) + padL('P.UNI', cols.priceW) + padL('TOTAL', cols.totalW);
  parts.push(cmdBold(true));
  parts.push(textLine(headerLine));
  parts.push(separatorLine(maxChars));
  parts.push(cmdBold(false));

  for (const item of items) {
    const pName = item.product?.name || item.productName || 'Sin nombre';
    const qty = item.quantity || 0;
    const unit = item.product?.vendePorPeso ? (' ' + (item.product.unidadPeso || 'kg')) : '';
    const qtyStr = qty % 1 === 0 ? String(qty) + unit : qty.toFixed(2) + unit;
    // Ajustar precio y total segun modo de moneda
    const itemUnit = item.unitPrice || 0;
    const itemTot = item.total || 0;
    const pInBs = itemUnit * exRate;
    const tInBs = itemTot * exRate;
    const priceStr = fmtN(useBsUnit || (!useUsdUnit && cMode === 'dual') ? pInBs : itemUnit);
    const totalStr = fmtN(cMode === 'unit_bs_total_usd' ? itemTot : (cMode === 'usd_only' ? itemTot : (cMode === 'unit_usd_total_bs' ? tInBs : (cMode === 'bs_only' ? tInBs : tInBs))));

    // Nueva orden: CANT + PRODUCTO + P.UNI + TOTAL
    const cantPart = padL(qtyStr, cols.cantW);
    const numPart = padL(priceStr, cols.priceW) + padL(totalStr, cols.totalW);
    const nameLines = wrapName(pName, safeNameW);

    // Las primeras lineas: PRODUCTO solo (wrap de nombre largo)
    for (let i = 0; i < nameLines.length - 1; i++) {
      parts.push(textLine(nameLines[i]));
    }
    // La ultima linea lleva PRODUCTO + CANT + P.UNI + TOTAL
    const lastName = nameLines[nameLines.length - 1];
    // Segurizar: truncar si por alguna razon excede maxChars
    const fullLine = lastName + cantPart + numPart;
    parts.push(textLine(fullLine.length > maxChars ? fullLine.substring(0, maxChars) : fullLine));
    // Verificacion de seguridad: si la linea se truncó, registrar en consola
    if (fullLine.length > maxChars) {
      console.warn('[ESC/POS] Linea truncada:', fullLine.length, '>', maxChars);
    }
  }

  parts.push(separatorLine(maxChars));

  // ═══ DESCUENTO — tamano normal ═══
  if (receipt.discount > 0) {
    const descVal = '-' + currency + ' ' + fmtN(receipt.discount);
    parts.push(textLine(padR('Desc:', 12) + padL(descVal, maxChars - 12)));
  }

  // ═══ TOTAL ═══
  // En 80mm (halfChars=24): doble ancho, caben 24 chars
  // En 58mm (halfChars=16): TAMANO NORMAL con negrita, caben 32 chars
  // Esto evita truncar montos grandes en papel de 58mm
  parts.push(cmdBold(true));
  if (halfChars >= 20) {
    // 80mm: usar doble ancho
    parts.push(cmdSize(0x01));
    {
      const label = 'TOTAL:';
      const totalVal = useBsTotal ? receipt.totalBs : receipt.total;
      const totalSuffix = useBsTotal ? 'Bs' : currency;
      const val = fmtN(totalVal) + totalSuffix;
      const totalStr = padR(label, 7) + padL(val, halfChars - 7);
      parts.push(textLine(truncate(totalStr, halfChars)));
    }
    parts.push(cmdSize(0x00));
  } else {
    // 58mm: tamano normal con negrita (32 chars disponibles)
    {
      const label = 'TOTAL:';
      const totalVal = useBsTotal ? receipt.totalBs : receipt.total;
      const totalSuffix = useBsTotal ? 'Bs' : currency;
      const val = fmtN(totalVal) + totalSuffix;
      const totalStr = padR(label, 7) + padL(val, maxChars - 7);
      parts.push(textLine(totalStr));
    }
  }
  parts.push(cmdBold(false));

  // ═══ TASA DE CAMBIO — tamano normal ═══
  if (ticketShowExchange && cMode !== 'bs_only') {
    parts.push(textLine('USD: ' + fmtN(receipt.total) + ' | Tasa: 1$=' + receipt.exchangeRate + 'Bs'));
  }

  // ═══ EFECTIVO / VUELTO ═══
  if (!isCreditSale && (receipt.paymentMethod === 'efectivo' || receipt.paymentMethod === 'efectivo-usd') && (receipt.cashReceived ?? 0) > 0) {
    parts.push(separatorLine(maxChars));
    const currSymbol = receipt.paymentMethod === 'efectivo' ? 'Bs' : '$';
    parts.push(textLine(padR('Recibido:', 10) + padL(currSymbol + ' ' + fmtN(receipt.cashReceived!), maxChars - 10)));

    if ((receipt.vuelto ?? 0) > 0) {
      // Vuelto: igual que TOTAL, doble ancho solo en 80mm
      parts.push(cmdBold(true));
      if (halfChars >= 20) {
        parts.push(cmdSize(0x01));
        {
          const vLabel = 'Vuelto:';
          const vVal = currSymbol + ' ' + fmtN(receipt.vuelto!);
          const vStr = padR(vLabel, 8) + padL(vVal, halfChars - 8);
          parts.push(textLine(truncate(vStr, halfChars)));
        }
        parts.push(cmdSize(0x00));
      } else {
        // 58mm: tamano normal
        {
          const vLabel = 'Vuelto:';
          const vVal = currSymbol + ' ' + fmtN(receipt.vuelto!);
          const vStr = padR(vLabel, 8) + padL(vVal, maxChars - 8);
          parts.push(textLine(vStr));
        }
      }
      parts.push(cmdBold(false));
    }
  }

  // ═══ PIE DE PAGINA — tamano normal ═══
  parts.push(doubleLine(maxChars));
  parts.push(cmdAlign(1)); // centrado

  if (ticketFooterMsg) {
    if (ticketShowSlogan) {
      parts.push(cmdBold(true));
      parts.push(textLine(ticketFooterMsg));
      parts.push(cmdBold(false));
    } else {
      parts.push(textLine(ticketFooterMsg));
    }
  }

  // ID al final (despues del mensaje footer)
  parts.push(textLine('ID: ' + receipt.id.slice(0, 8)));

  parts.push(cmdFeed(3));
  parts.push(cmdCut());

  return concatArrays(...parts);
}

// ─── Utilidad: wrap texto generico (no padding) ──────────────────
function wrapText(s: string, maxLen: number): string[] {
  if (s.length <= maxLen) return [s];
  const lines: string[] = [];
  let rem = s;
  while (rem.length > 0) {
    if (rem.length <= maxLen) {
      lines.push(rem);
      rem = '';
    } else {
      let brk = rem.lastIndexOf(' ', maxLen);
      if (brk <= 0) brk = maxLen;
      lines.push(rem.substring(0, brk));
      rem = rem.substring(brk).trimStart();
    }
  }
  return lines;
}

// Alias
export function bufferToBase64(buf: Uint8Array): string {
  return uint8ToBase64(buf);
}
