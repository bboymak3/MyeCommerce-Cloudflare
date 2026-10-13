/**
 * ticket-printer.ts — impresion de tickets desde el navegador.
 *
 * El POS corre en Cloudflare: no hay agente local al que mandar ESC/POS (el agente
 * de la version Windows escuchaba en localhost:9100 de la PC, que el servidor en la
 * nube no puede alcanzar). El ticket se arma en HTML a la medida del papel
 * (55/57/58/80 mm, ver PRINTER_PRESETS) y se imprime con el dialogo del navegador
 * desde un iframe oculto: no abre ventanas emergentes, que Chrome bloquea despues de
 * guardar la venta. La impresora termica debe estar instalada en el equipo y
 * elegida en el dialogo (margenes: ninguno); con Chrome en modo --kiosk-printing
 * imprime sin dialogo.
 */


// ─── Etiquetas de metodos de pago ───────────────────────────────────
export const TICKET_PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo (Bs)',
  'efectivo-usd': 'Efectivo ($)',
  transferencia: 'Transferencia',
  'pago-movil': 'Pago Movil',
  'punto-de-venta': 'Punto de Venta',
  biopago: 'Biopago',
  cashea: 'Cashea',
  zelle: 'Zelle ($)',
  usdt: 'USDT ($)',
};

// ─── Presets de impresora ──────────────────────────────────────────
export interface PrinterPreset {
  paperMm: string;
  contentMm: number;
  paddingMm: number;
  baseFontSize: number;
  smallFontSize: number;
  maxFontSize: number;
  minFontSize: number;
  winPx: number;
}

export const PRINTER_PRESETS: Record<string, PrinterPreset> = {
  '55mm': { paperMm: '55mm', contentMm: 48, paddingMm: 1, baseFontSize: 7, smallFontSize: 6, maxFontSize: 9, minFontSize: 5, winPx: 280 },
  '57mm': { paperMm: '57mm', contentMm: 50, paddingMm: 1, baseFontSize: 7, smallFontSize: 6, maxFontSize: 9, minFontSize: 5, winPx: 290 },
  '58mm': { paperMm: '58mm', contentMm: 52, paddingMm: 1, baseFontSize: 8, smallFontSize: 6, maxFontSize: 10, minFontSize: 5, winPx: 300 },
  '80mm': { paperMm: '80mm', contentMm: 74, paddingMm: 2, baseFontSize: 10, smallFontSize: 8, maxFontSize: 16, minFontSize: 6, winPx: 420 },
};

export function getPreset(width: string): PrinterPreset {
  return PRINTER_PRESETS[width] || PRINTER_PRESETS['58mm'];
}

export function calcCharsPerMm(fontSize: number): number {
  return 6.3 / Math.max(fontSize, 4);
}

export function calcMaxChars(contentMm: number, fontSize: number): number {
  return Math.max(16, Math.floor(contentMm * calcCharsPerMm(fontSize)));
}

// ─── Interfaces ────────────────────────────────────────────────────
export interface TicketSettings {
  storeName: string;
  storeRif: string;
  storeAddress: string;
  storePhone: string;
  ticketFontSize: number;
  ticketFontFamily: string;
  ticketBold: boolean;
  ticketShowPhone: boolean;
  ticketShowSeller: boolean;
  ticketShowExchange: boolean;
  ticketShowSlogan: boolean;
  ticketPaperWidth: string;
  ticketMarginLeft: number;
  ticketMarginRight: number;
  ticketHeaderMsg: string;
  ticketFooterMsg: string;
  // Nuevos campos para agente ESC/POS
  ticketUseAgent?: boolean;
  ticketAgentUrl?: string;
 ticketShowCashReceived?: boolean;
  ticketShowLogo?: boolean;
  ticketCurrencyMode?: string;
  // Logo del negocio
  storeLogo?: string;
  businessType?: string;
  // IVA
  taxMode?: string;
  taxRate?: number;
}

export interface TicketReceipt {
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

// ─── Utilidades ───────────────────────────────────────────────────
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Emojis por tipo de negocio para el ticket
const BUSINESS_EMOJIS: Record<string, string> = {
  general: '🏪', panaderia: '🥖', pasteleria: '🧁', carniceria: '🥩',
  farmacia: '💊', supermercado: '🛒', restaurante: '🍽️', cafe: '☕',
  ferreteria: '🔧', ropa: '👕', zapateria: '👟', optica: '👓',
  licoreria: '🍷', beauty: '💄', veterinaria: '🐾', papelera: '📝',
  moto: '🏍️', computadora: '💻', celular: '📱', electricidad: '⚡',
  gasolina: '⛽', verdura: '🥬', polleria: '🍗', pescaderia: '🐟',
  fruteria: '🍎', jugueria: '🧃', panchos: '🌭', pizza: '🍕',
  repuestos: '🔩', transporte: '🚗', boutique: '👗', joyeria: '💍',
  abarrotes: '🛍️', carnes: '🥩', dulceria: '🍬', fotografia: '📸',
  heladeria: '🍦', imprenta: '🖨️', libreria: '📚', loteria: '🎰',
  lubricentro: '🛢️', market: '🏬', muebles: '🛋️', musica: '🎵',
  nutricion: '🥗', paintball: '🎯', peluqueria: '💇', regalos: '🎁',
  smarthphone: '📲', tacos: '🌮', tintoreria: '👔', videojuegos: '🎮',
};

function padL(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

function padR(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

// ─── Utilidad: calcular precio base sin IVA (desglose) ─────────
function getBasePrice(unitPrice: number, taxType: string, taxMode: string | undefined, taxRate: number): number {
  if (taxMode !== 'included' || !taxRate || taxRate <= 0) return unitPrice;
  if (taxType === 'exento' || taxType === 'omitido') return unitPrice;
  return unitPrice / (1 + taxRate / 100);
}

function itemTaxType(item: any): string {
  return item.taxType || item.product?.taxType || 'general';
}

// ─── Columnas dinamicas ───────────────────────────────────────────
interface ColWidths {
  cantW: number;
  priceW: number;
  totalW: number;
  nameW: number;
}

function calcColumnWidths(items: any[], maxChars: number, taxMode?: string, taxRate?: number): ColWidths {
  let maxQty = 0, maxPrice = 0, maxTotal = 0;
  for (const item of items) {
    const qty = item.quantity || 0;
    const unit = item.product?.vendePorPeso ? (' ' + (item.product.unidadPeso || 'kg')) : '';
    const qtyStr = qty % 1 === 0 ? String(qty) + unit : qty.toFixed(2) + unit;
    const tt = itemTaxType(item);
    const bp = getBasePrice(item.unitPrice || 0, tt, taxMode, taxRate || 0);
    const bt = bp * qty;
    const priceStr = (bp.toFixed(2).replace('.', ',')).replace(',00', '');
    const totalStr = (bt.toFixed(2).replace('.', ',')).replace(',00', '');
    if (qtyStr.length > maxQty) maxQty = qtyStr.length;
    if (priceStr.length > maxPrice) maxPrice = priceStr.length;
    if (totalStr.length > maxTotal) maxTotal = totalStr.length;
  }
  let cantW = Math.max(maxQty, 3) + 3;
  let priceW = Math.max(maxPrice, 4) + 3;
  let totalW = Math.max(maxTotal, 6);

  // SEGURIDAD: garantizar que las columnas numericas + nombre no excedan maxChars
  const minNameW = 6;
  const maxNumeric = maxChars - minNameW;
  if (cantW + priceW + totalW > maxNumeric) {
    const totalNumeric = cantW + priceW + totalW;
    const scale = maxNumeric / totalNumeric;
    cantW = Math.max(Math.round(cantW * scale), 4);
    priceW = Math.max(Math.round(priceW * scale), 5);
    totalW = Math.max(Math.round(totalW * scale), 5);
    const diff = cantW + priceW + totalW - maxNumeric;
    if (diff > 0) {
      priceW = Math.max(priceW - diff, 5);
    }
  }
  const nameW = Math.max(maxChars - cantW - priceW - totalW, 6);
  return { cantW, priceW, totalW, nameW };
}

// ─── Wrapping de nombres ─────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════
// MODE 2: Fallback HTML (window.print)
// ═══════════════════════════════════════════════════════════════════

function printViaHtml(params: {
  receipt: TicketReceipt;
  settings: TicketSettings;
  currency?: string;
  defaultSellerName?: string;
}): boolean {
  const { receipt, settings, currency = 'USD', defaultSellerName = '' } = params;

  const d = new Date(receipt.date);
  const dateStr = d.toLocaleDateString('es-VE');
  const timeStr = d.toLocaleTimeString('es-VE');

  const {
    storeName, storeRif, storeAddress, storePhone,
    ticketFontSize, ticketFontFamily, ticketBold,
    ticketShowPhone, ticketShowSeller, ticketShowExchange, ticketShowSlogan,
    ticketShowCashReceived, ticketShowLogo,
    ticketPaperWidth, ticketMarginLeft, ticketMarginRight,
    ticketHeaderMsg, ticketFooterMsg,
    storeLogo, businessType,
    taxMode, taxRate,
  } = settings;

  const preset = getPreset(ticketPaperWidth);
  const paperW = preset.paperMm;
  const contentMm = preset.contentMm;
  const padMm = preset.paddingMm;
  const mlMm = Math.min(ticketMarginLeft ?? 0, 5);
  const mrMm = Math.min(ticketMarginRight ?? 0, 5);
  const pad = `${padMm}mm ${mrMm}mm ${padMm}mm ${mlMm}mm`;

  const base = Math.min(Math.max(ticketFontSize || preset.baseFontSize, preset.minFontSize), preset.maxFontSize);
  const small = Math.max(preset.minFontSize, preset.smallFontSize);
  const storeNameSize = Math.min(base + 1, preset.maxFontSize + 1);
  const totalSize = Math.min(base + 1, preset.maxFontSize + 1);
  const footerSize = Math.max(4, base - 1);

  const effectiveMm = contentMm - mlMm - mrMm;
  const maxLineChars = Math.max(16, Math.floor(effectiveMm * calcCharsPerMm(base)));

  const isCreditSale = receipt.isCredit === true;
  const payLabel = isCreditSale
    ? 'CREDITO'
    : (receipt.paymentMethod === 'mixto' ? 'Mixto' : TICKET_PAYMENT_LABELS[receipt.paymentMethod] || receipt.paymentMethod);

  let mixedBreakdown = '';
  if (receipt.paymentMethod === 'mixto' && receipt.mixedPaymentJson) {
    try {
      const entries = JSON.parse(receipt.mixedPaymentJson);
      mixedBreakdown = entries.map((e: any) =>
        `${TICKET_PAYMENT_LABELS[e.method] || e.method}: ${parseFloat(e.amountBs).toFixed(2)}Bs`
      ).join(' | ');
    } catch { /* ignore */ }
  }

  const fmtN = (n: number) => { const s = n.toFixed(2).replace('.', ','); return s.endsWith(',00') ? s.slice(0, -3) : s; };

  const clientName = receipt.clientName || receipt.customerName || '';
  const isFinalClient = !clientName || clientName === 'CLIENTE FINAL' || clientName === 'Consumidor Final';

  // Número de factura / correlativo
  const invoiceNum = (receipt as any).invoiceNumber || '';
  const invoiceNumHtml = invoiceNum;

  const items = receipt.items || [];
  const cols = calcColumnWidths(items, maxLineChars, taxMode, taxRate);
  const sepLine = '\u2500'.repeat(maxLineChars);
  const headerLine = padR('PRODUCTO', cols.nameW) + padL('CANT', cols.cantW) + padL('P.UNI', cols.priceW) + padL('TOTAL', cols.totalW);

  const itemTextLines: string[] = [];
  let calcSubtotal = 0;
  for (const item of items) {
    const pName = item.product?.name || item.productName || 'Sin nombre';
    const qty = item.quantity || 0;
    const unit = item.product?.vendePorPeso ? (' ' + (item.product.unidadPeso || 'kg')) : '';
    const qtyStr = qty % 1 === 0 ? String(qty) + unit : qty.toFixed(2) + unit;
    const tt = itemTaxType(item);
    const bp = getBasePrice(item.unitPrice || 0, tt, taxMode, taxRate || 0);
    const bt = bp * qty;
    calcSubtotal += bt;
    const priceStr = (bp.toFixed(2).replace('.', ',')).replace(',00', '');
    const totalStr = (bt.toFixed(2).replace('.', ',')).replace(',00', '');
    const cantPart = padL(qtyStr, cols.cantW);
    const numPart = padL(priceStr, cols.priceW) + padL(totalStr, cols.totalW);
    const nameLines = wrapName(pName, cols.nameW);
    for (let i = 0; i < nameLines.length - 1; i++) {
      itemTextLines.push(nameLines[i]);
    }
    itemTextLines.push(nameLines[nameLines.length - 1] + cantPart + numPart);
  }
  const itemLinesHtml = itemTextLines.map(l => escHtml(l)).join('\n');

  const html = (`<!DOCTYPE html><html><head><title>Ticket</title>
<style>
  @page{size:${paperW} auto;margin:0;padding:0}
  *{margin:0;padding:0;box-sizing:border-box}
  html{width:${paperW}}
  body{
    font-family:${ticketFontFamily};
    font-size:${base}px;
    font-weight:${ticketBold ? 'bold' : 'normal'};
    width:${contentMm}mm;
    margin:0 auto;
    padding:${pad};
    color:#000;
    overflow:visible;
    text-align:left;
  }
  .b{font-weight:bold}
  .s{font-size:${small}px}
  .r{display:flex;width:100%;align-items:baseline}
  .r .k{flex-shrink:0;white-space:nowrap;overflow:hidden}
  .r .v{flex-shrink:0;white-space:nowrap;overflow:hidden;margin-left:auto}
  .ln{border-top:1px solid #000;margin:1px 0}
  .ln2{border-top:2px double #000;margin:2px 0}
  .cb{display:inline-block;border:2px solid #000;padding:1px 4px;font-weight:bold;font-size:${base}px;letter-spacing:1px}
  .fc{font-size:${footerSize}px;text-align:center;margin-top:2px;white-space:pre-wrap}
  .fb{font-size:${base}px;font-weight:bold;text-align:center;margin-top:2px;padding:1px 0;border-top:1px solid #000;border-bottom:1px solid #000;white-space:pre-wrap}
  .items-grid{
    font-family:'Courier New',monospace;
    font-size:${base}px;
    font-weight:normal;
    line-height:1.3;
    white-space:pre;
    overflow:visible;
    width:100%;
  }
  .items-header{
    font-weight:bold;
    border-bottom:1px solid #000;
    padding-bottom:1px;
    margin-bottom:0;
  }
  @media print{
    html,body{width:${contentMm}mm!important;margin:0 auto!important;padding:${pad}!important;overflow:visible!important}
  }
</style></head><body>
${(() => {
  if (ticketShowLogo === true && storeLogo) {
    return `<div style="text-align:center;margin-bottom:2px"><img src="${storeLogo}" style="max-width:${Math.min(contentMm * 2.5, 120)}px;max-height:80px;object-fit:contain" /></div>`;
  }
  const bizEmoji = BUSINESS_EMOJIS[businessType || 'general'] || '\u{1F3EA}';
  return `<div style="text-align:center;font-size:28px;margin-bottom:2px">${bizEmoji}</div>`;
})()}
<div class="b" style="font-size:${storeNameSize}px;white-space:pre-wrap">${escHtml(storeName)}</div>
${storeRif ? `<div class="s">RIF: ${escHtml(storeRif)}</div>` : ''}
${storeAddress ? `<div class="s" style="white-space:pre-wrap">${escHtml(storeAddress)}</div>` : ''}
${ticketShowPhone && storePhone ? `<div class="s">Tel: ${escHtml(storePhone)}</div>` : ''}
${ticketHeaderMsg ? `<div class="b" style="font-size:${base}px;margin-top:1px;white-space:pre-wrap">${escHtml(ticketHeaderMsg)}</div>` : ''}
<div class="ln2"></div>

<div class="s">Fecha: ${dateStr} ${timeStr}</div>
${invoiceNumHtml ? `
<div class="b" style="font-size:${base}px">FACTURA DE VENTA</div>
<div class="b" style="font-size:${base}px">N. ${escHtml(invoiceNumHtml)}</div>
` : ''}
${!isFinalClient ? `
  <div style="font-size:${base}px;font-weight:bold;white-space:pre-wrap">Cliente: ${escHtml(clientName)}</div>
  ${receipt.clientDocNumber ? `<div class="s">CI/RIF: ${escHtml(receipt.clientDocType || 'V')}-${escHtml(receipt.clientDocNumber)}</div>` : ''}
  ${receipt.clientAddress ? `<div class="s" style="white-space:pre-wrap">${escHtml(receipt.clientAddress)}</div>` : ''}
` : `<div style="font-size:${base}px;font-weight:bold">Cliente: Consumidor Final</div>`}

<div class="ln"></div>

${isCreditSale ? `<div style="text-align:center"><span class="cb">CREDITO</span></div>` : ''}
${isCreditSale ? (() => {
  const due = receipt.creditDueDate ? new Date(receipt.creditDueDate) : null;
  const dueStr = due ? due.toLocaleDateString('es-VE') : '';
  return `<div class="s" style="margin-top:1px">Plazo: <b>${receipt.creditDays || 30}d</b>${dueStr ? ' Vence: <b>' + dueStr + '</b>' : ''}</div>`;
})() : ''}
<div style="margin-top:1px;font-size:${base}px;font-weight:bold">Pago: ${escHtml(payLabel)}</div>

${!isCreditSale && mixedBreakdown ? `<div class="s" style="white-space:pre-wrap">${escHtml(mixedBreakdown)}</div>` : ''}
${ticketShowSeller && (receipt.sellerName || defaultSellerName) ? `<div style="font-size:${base}px;font-weight:bold">Cajero: ${escHtml(receipt.sellerName || defaultSellerName || '')}</div>` : ''}

<div class="ln"></div>

<div class="items-grid">
<div class="items-header">${escHtml(headerLine)}</div>
${sepLine}
${itemLinesHtml}
</div>

<div class="ln"></div>

${receipt.discount > 0 ? `<div class="r"><span class="k">Desc:</span><span class="v">-Bs ${fmtN(receipt.discount * (receipt.exchangeRate || 1))}</span></div>` : ''}
${(receipt.taxAmount ?? 0) > 0 ? `
  <div class="r"><span class="k">Subtotal:</span><span class="v">Bs ${fmtN(calcSubtotal * (receipt.exchangeRate || 1))}</span></div>
  <div class="r"><span class="k">IVA${taxMode === 'included' ? ' incl.' : '+'} (${taxRate || 0}%):</span><span class="v">Bs ${fmtN((receipt.taxAmount || 0) * (receipt.exchangeRate || 1))}</span></div>
` : ''}
<div class="r" style="margin-top:1px">
  <span class="k b" style="font-size:${totalSize}px">TOTAL:</span>
  <span class="v b" style="font-size:${totalSize}px">Bs ${fmtN(receipt.totalBs)}</span>
</div>

${ticketShowExchange ? `
  <div class="s" style="margin-top:1px">$: ${fmtN(receipt.total)} | Tasa: 1$=${receipt.exchangeRate}Bs</div>
` : ''}

${/* Monto recibido y vuelto eliminados del ticket */ ''}

<div class="ln2"></div>

${ticketFooterMsg ? (ticketShowSlogan
  ? `<div class="fb">${escHtml(ticketFooterMsg)}</div>`
  : `<div class="fc">${escHtml(ticketFooterMsg)}</div>`
) : ''}

<div class="s" style="text-align:center;margin-top:2px">ID: ${escHtml(receipt.id.slice(0, 8))}</div>

</body></html>`);
  return printHtmlDocument(html);
}

/**
 * Imprime un documento HTML desde un iframe oculto (sin ventana emergente) y lo
 * retira al terminar. Espera a que carguen las imagenes (logo) antes de imprimir.
 */
function printHtmlDocument(html: string): boolean {
  if (typeof document === 'undefined') return false;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return false; }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  const doPrint = () => {
    try { win.focus(); win.print(); } finally { cleanup(); }
  };
  const images = Array.from(doc.images);
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) { setTimeout(doPrint, 50); return true; }
  let left = pending.length;
  const done = () => { if (--left === 0) doPrint(); };
  pending.forEach((img) => { img.addEventListener('load', done); img.addEventListener('error', done); });
  setTimeout(() => { if (left > 0) { left = 0; doPrint(); } }, 3000);
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// PRINT TICKET — Funcion principal (dual mode)
// ═══════════════════════════════════════════════════════════════════

/** Imprime el ticket con el dialogo del navegador. Devuelve false si no se pudo preparar. */
export async function printTicket(params: {
  receipt: TicketReceipt;
  settings: TicketSettings;
  currency?: string;
  defaultSellerName?: string;
}): Promise<boolean> {
  return printViaHtml(params);
}
