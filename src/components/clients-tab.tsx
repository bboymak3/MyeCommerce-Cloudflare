"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

interface Client {
  id: string;
  type: string;
  docType: string;
  docNumber: string;
  fullName: string;
  firstName: string;
  lastName: string;
  businessName: string;
  phone: string;
  email: string;
  address: string;
  taxInfo: string;
  isFinalClient: boolean;
  isActive: boolean;
  creditBalance: number;
  creditLimit: number;
  _count?: { sales: number };
};

interface ClientsTabProps {
  bcvRate: number;
  currency: string;
  storeRif?: string;
  storeName?: string;
  storeAddress?: string;
}

const DOC_TYPES = [
  { value: "V", label: "V - Cedula Venezolana" },
  { value: "E", label: "E - Extranjero" },
  { value: "J", label: "J - RIF Juridico" },
  { value: "G", label: "G - RIF Gobierno" },
  { value: "P", label: "P - Pasaporte" },
];

export default function ClientsTab({ bcvRate, currency, storeRif, storeName, storeAddress }: ClientsTabProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    type: "natural",
    docType: "V",
    docNumber: "",
    firstName: "",
    lastName: "",
    businessName: "",
    phone: "",
    email: "",
    address: "",
    taxInfo: "",
    creditLimit: "",
  });
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── PAGINATION ───
  const ITEMS_PER_PAGE = 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(clients.length / ITEMS_PER_PAGE));
  const paginatedClients = clients.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  useEffect(() => { setPage(1); }, [search, filterType]);

  // ===== HISTORIAL DE COMPRAS =====
  const [histClient, setHistClient] = useState<Client | null>(null);
  const [histSales, setHistSales] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histDateFrom, setHistDateFrom] = useState('');
  const [histDateTo, setHistDateTo] = useState('');
  const [detailSale, setDetailSale] = useState<any>(null);
  // Client statistics
  const [clientStats, setClientStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const loadHistory = async (client: Client) => {
    setHistClient(client);
    setHistDateFrom('');
    setHistDateTo('');
    setHistLoading(true);
    setDetailSale(null);
    try {
      const res = await authFetch(`/api/clients/${client.id}/purchases`);
      const data = await res.json();
      setHistSales(Array.isArray(data) ? data : []);
    } catch { setHistSales([]); }
    setHistLoading(false);
  };

  const filterHistory = async () => {
    if (!histClient) return;
    setHistLoading(true);
    try {
      const params = new URLSearchParams();
      if (histDateFrom) params.set('from', histDateFrom);
      if (histDateTo) params.set('to', histDateTo);
      const res = await authFetch(`/api/clients/${histClient.id}/purchases?${params}`);
      const data = await res.json();
      setHistSales(Array.isArray(data) ? data : []);
    } catch { setHistSales([]); }
    setHistLoading(false);
  };

  const clearHistFilter = () => {
    setHistDateFrom('');
    setHistDateTo('');
    if (histClient) loadHistory(histClient);
  };

  const loadClientStats = async () => {
    if (clientStats) { setShowStats(!showStats); return; }
    setStatsLoading(true);
    try {
      const res = await authFetch('/api/clients/stats');
      const data = await res.json();
      setClientStats(data);
      setShowStats(true);
    } catch { toast.error("Error al cargar estadisticas"); }
    setStatsLoading(false);
  };

  const getSaleStatus = (sale: any) => {
    if (!sale.isCredit) return 'completada';
    const paid = sale.creditPaid || 0;
    if (paid >= sale.total) return 'completada';
    if (sale.creditDueDate && new Date(sale.creditDueDate) < new Date()) return 'vencida';
    return 'pendiente';
  };

  const histSummary = histSales.length > 0 ? {
    count: histSales.length,
    totalUsd: histSales.reduce((s: number, v: any) => s + (v.total || 0), 0),
    totalBs: histSales.reduce((s: number, v: any) => s + (v.totalBs || 0), 0),
  } : null;

  const reprintFromHistory = async (sale: any) => {
    try {
      const stRes = await authFetch("/api/settings");
      const st = await stRes.json();
      const storeName = st.storeName || "Mi Tienda";
      const storeRif = st.storeRif || "";
      const storeAddress = st.storeAddress || "";
      const storePhone = st.storePhone || "";
      const ticketFont = st.ticketFontFamily || st.ticketFont || 'monospace';
      const ticketFontSize = parseInt(st.ticketFontSize) || 12;
      const ticketBold = st.ticketBold === true;
      const ticketShowPhone = st.ticketShowPhone !== false;
      const ticketShowExchange = st.ticketShowExchange !== false;
      const ticketShowSeller = st.ticketShowSeller !== false;
      const ticketShowSlogan = st.ticketShowSlogan === true;
      const ticketFooterMsg = st.ticketFooterMsg || "";
      const ticketHeaderMsg = st.ticketHeaderMsg || "";
      const base = ticketFontSize;
      const small = Math.max(7, base - 3);
      const storeNameSize = base + 2;
      const totalSize = base + 3;
      const footerSize = Math.max(7, base - 2);

      // Soporte 58mm / 80mm
      const is58 = st.ticketPaperWidth === '58mm';
      const paperW = is58 ? '58mm' : '80mm';
      const winW = is58 ? 320 : 420;
      const pad = is58 ? '2mm 2mm' : '3mm 4mm';

      const d = new Date(sale.date);
      const dateStr = d.toLocaleDateString('es-VE');
      const timeStr = d.toLocaleTimeString('es-VE');
      const isCreditSale = sale.isCredit === true;
      const payLabel = isCreditSale ? 'CREDITO' : (sale.paymentMethod === 'mixto' ? 'Mixto' : PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod);

      // Formato VE: coma decimal
      const fmtN = (n: number) => n.toFixed(2).replace('.', ',');
      const fmtQty = (item: any) => {
        const qty = item.quantity;
        const unit = item.product?.vendePorPeso ? (' ' + (item.product.unidadPeso || 'kg')) : '';
        return qty % 1 === 0 ? qty.toString() + unit : qty.toFixed(3) + unit;
      };

      let mixedBreakdown = '';
      if (sale.paymentMethod === 'mixto' && sale.mixedPaymentJson) {
        try {
          const entries = JSON.parse(sale.mixedPaymentJson);
          mixedBreakdown = entries.map((e: any) =>
            `  ${PAYMENT_LABELS[e.method] || e.method}: Bs ${parseFloat(e.amountBs).toFixed(2)}` +
            (e.reference ? ` | Ref: ${e.reference}` : '')
          ).join('\n');
        } catch {}
      }

      // Items - adaptado a 58mm (3 cols) o 80mm (4 cols)
      let itemsHtml = '';
      let tableHeaderHtml = '';
      if (is58) {
        tableHeaderHtml = `<tr style="border-bottom:1px solid #000">
            <td style="border-right:1px solid #000;text-align:right;padding:2px 2px;width:12%;font-size:${small}px;font-weight:bold">CANT.</td>
            <td style="border-right:1px solid #000;padding:2px 2px;width:58%;font-size:${small}px;font-weight:bold">ARTICULO</td>
            <td style="text-align:right;padding:2px 2px;width:30%;font-size:${small}px;font-weight:bold">TOTAL</td>
          </tr>`;
        itemsHtml = (sale.items || []).map((item: any) => {
          const pName = item.product?.name || item.productName || '';
          return `<tr style="border-bottom:1px dotted #ccc">
            <td style="text-align:right;padding:1px 2px;width:12%;vertical-align:top">${fmtQty(item)}</td>
            <td style="padding:1px 2px;width:58%;vertical-align:top;word-wrap:break-word">${pName}</td>
            <td style="text-align:right;padding:1px 2px;width:30%;vertical-align:top">${fmtN(item.total)}</td>
          </tr>`;
        }).join('');
      } else {
        tableHeaderHtml = `<tr style="border-bottom:1px solid #000">
            <td style="border-right:1px solid #000;text-align:right;padding:2px 3px;width:9%;font-size:${small}px;font-weight:bold">CANT.</td>
            <td style="border-right:1px solid #000;padding:2px 3px;width:44%;font-size:${small}px;font-weight:bold">ARTICULO</td>
            <td style="border-right:1px solid #000;text-align:right;padding:2px 3px;width:21%;font-size:${small}px;font-weight:bold">P.UNI</td>
            <td style="text-align:right;padding:2px 3px;width:26%;font-size:${small}px;font-weight:bold">TOTAL</td>
          </tr>`;
        itemsHtml = (sale.items || []).map((item: any) => {
          const pName = item.product?.name || item.productName || '';
          const pPrice = item.unitPrice || 0;
          return `<tr style="border-bottom:1px dotted #ccc">
            <td style="text-align:right;padding:2px 3px;width:9%;vertical-align:top">${fmtQty(item)}</td>
            <td style="padding:2px 3px;width:44%;vertical-align:top;word-wrap:break-word">${pName}</td>
            <td style="text-align:right;padding:2px 3px;width:21%;vertical-align:top">${pPrice > 0 ? fmtN(pPrice) : ''}</td>
            <td style="text-align:right;padding:2px 3px;width:26%;vertical-align:top">${fmtN(item.total)}</td>
          </tr>`;
        }).join('');
      }

      const pw = window.open('', '_blank', `width=${winW},height=800`);
      if (!pw) { toast.error('Permita ventanas emergentes'); return; }
      pw.document.write(`<!DOCTYPE html><html><head><title>Ticket</title>
        <style>
          @page{size:${paperW} auto;margin:0}
          *{margin:0;padding:0;box-sizing:border-box}
          html{width:${paperW}}
          body{font-family:${ticketFont};font-size:${base}px;font-weight:${ticketBold ? 'bold' : 'normal'};width:${paperW};margin:0 auto;padding:${pad};color:#000;overflow-wrap:break-word;word-wrap:break-word;-webkit-text-size-adjust:100%}
          .c{text-align:center}.b{font-weight:bold}.s{font-size:${small}px;font-weight:normal}
          .row{display:flex;justify-content:space-between;align-items:baseline}
          .row .k{font-weight:normal;white-space:nowrap}.row .v{font-weight:bold;text-align:right;white-space:nowrap;margin-left:auto}
          table{width:100%;border-collapse:collapse}
          td{overflow-wrap:break-word;word-wrap:break-word}
          .line{border-top:1px solid #000;margin:4px 0}
          .line-d{border-top:2px double #000;margin:5px 0}
          .credit-box{display:inline-block;border:2px solid #000;padding:2px ${is58 ? '4' : '8'}px;font-weight:bold;font-size:${base + 1}px;letter-spacing:1px}
          .footer-c{font-size:${footerSize}px;text-align:center;margin-top:4px}
          .footer-b{font-size:${base - 1}px;font-weight:bold;text-align:center;margin-top:6px;padding:3px 0;border-top:1px solid #000;border-bottom:1px solid #000}
          @media print{html,body{width:${paperW}!important;margin:0 auto!important;padding:${pad}!important}}
        </style></head><body>

        <div class="b" style="font-size:${storeNameSize}px;word-wrap:break-word">${storeName}</div>
        ${storeRif ? `<div class="s">RIF: ${storeRif}</div>` : ''}
        ${storeAddress ? `<div class="s" style="word-wrap:break-word">${storeAddress}</div>` : ''}
        ${ticketShowPhone && storePhone ? `<div class="s">Tel: ${storePhone}</div>` : ''}

        ${ticketHeaderMsg ? `<div class="b" style="font-size:${base}px;margin-top:4px;word-wrap:break-word">${ticketHeaderMsg}</div>` : ''}

        <div class="line-d"></div>

        <div class="s">Doc: ${sale.id.slice(0, 8)}</div>
        <div class="s">Fecha: ${dateStr}  ${timeStr}</div>
        ${sale.clientName && sale.clientName !== 'CLIENTE FINAL' ? `
          <div class="s">Cliente: ${sale.clientName}</div>
        ` : `<div class="s">Cliente: Consumidor Final</div>`}

        <div class="line"></div>

        ${isCreditSale ? `<div class="c"><span class="credit-box">VENTA A CREDITO</span></div>` : ''}
        <div class="row" style="margin-top:3px"><span class="k s">Pago:</span><span class="v">${payLabel}</span></div>
        ${!isCreditSale && mixedBreakdown ? `<div class="s" style="white-space:pre-line;word-wrap:break-word">${mixedBreakdown}</div>` : ''}
        ${ticketShowSeller && sale.sellerName ? `<div class="row"><span class="k s">Vendedor:</span><span class="v">${sale.sellerName}</span></div>` : ''}

        <div class="line"></div>

        <table>
          ${tableHeaderHtml}
          ${itemsHtml}
        </table>

        <div class="line"></div>

        ${sale.discount > 0 ? `<div class="row"><span class="k">Descuento:</span><span class="v">-${fmtN(sale.discount)}</span></div>` : ''}
        <div class="row" style="margin-top:2px"><span class="k" style="font-size:${totalSize}px;font-weight:bold">TOTAL (Bs):</span><span class="v" style="font-size:${totalSize}px;font-weight:bold">${fmtN(sale.totalBs || 0)}</span></div>

        ${ticketShowExchange ? `
          <div class="s" style="margin-top:2px">USD: ${fmtN(sale.total || 0)}</div>
          <div class="s">Tasa: 1$ = ${sale.exchangeRate} Bs</div>
        ` : ''}

        <div class="line-d"></div>

        <div class="s">ID: ${sale.id.slice(0, 8)}</div>

        ${ticketFooterMsg ? (ticketShowSlogan
          ? `<div class="footer-b">${ticketFooterMsg}</div>`
          : `<div class="footer-c">${ticketFooterMsg}</div>`
        ) : ''}

        <script>window.onload=function(){window.print();window.close();}</script>
        </body></html>`);
      pw.document.close();
    } catch { toast.error('Error al reimprimir'); }
  };

  const PAYMENT_LABELS: any = { efectivo: "Efectivo", 'efectivo-usd': "Efectivo ($)", tarjeta: "Tarjeta", transferencia: "Transferencia", "pago-movil": "Pago Movil", "punto-de-venta": "Punto de Venta", mixto: "Mixto", credito: "Credito", cashea: "Cashea", cheque: "Cheque" };

  const loadClients = async (searchTerm?: string) => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (filterType) params.set("type", filterType);
      const res = await authFetch(`/api/clients?${params}`);
      const data = await res.json();
      setClients(data);
    } catch {
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [filterType]);

  // Auto-buscar con delay
  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => loadClients(value), 300);
  };

  const openCreate = () => {
    setEditingClient(null);
    setFormData({ type: "natural", docType: "V", docNumber: "", firstName: "", lastName: "", businessName: "", phone: "", email: "", address: "", taxInfo: "", creditLimit: "" });
    setShowDialog(true);
  };

  const exportClients = async (format: string) => {
    try {
      const res = await authFetch(`/api/clients/export?format=${format}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error HTTP ${res.status}`);
      }
      if (format === 'vcard') {
        const text = await res.text();
        const blob = new Blob([text], { type: "text/vcard" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "contactos-clientes.vcf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Contactos descargados - abre el archivo en tu telefono");
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `clientes-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Clientes exportados - incluye hoja de WhatsApp");
      }
    } catch (e: any) { toast.error(e.message || "Error al exportar"); }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      type: client.type,
      docType: client.docType,
      docNumber: client.docNumber,
      firstName: client.firstName,
      lastName: client.lastName,
      businessName: client.businessName,
      phone: client.phone,
      email: client.email,
      address: client.address,
      taxInfo: client.taxInfo,
      creditLimit: (client.creditLimit || 0).toString(),
    });
    setShowDialog(true);
  };

  const saveClient = async () => {
    const isJuridico = formData.type === "juridico";
    const fullName = isJuridico
      ? (formData.businessName || formData.docNumber)
      : `${formData.firstName} ${formData.lastName}`.trim() || formData.docNumber;

    if (!fullName || !formData.docNumber) {
      toast.error("Nombre y documento son requeridos");
      return;
    }

    setSaving(true);
    try {
      const url = editingClient ? "/api/clients" : "/api/clients";
      const method = editingClient ? "PUT" : "POST";
      const body = editingClient
        ? { id: editingClient.id, ...formData, fullName, creditLimit: parseFloat(formData.creditLimit) || 0 }
        : { ...formData, fullName, creditLimit: parseFloat(formData.creditLimit) || 0 };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(editingClient ? "Cliente actualizado" : "Cliente registrado");
      setShowDialog(false);
      loadClients(search);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (client: Client) => {
    if (client.isFinalClient) {
      toast.error("No se puede eliminar el Cliente Final del sistema");
      return;
    }
    if (!confirm(`Desactivar al cliente "${client.fullName}"?`)) return;
    try {
      await authFetch(`/api/clients?id=${client.id}`, { method: "DELETE" });
      toast.success("Cliente desactivado");
      loadClients(search);
    } catch {
      toast.error("Error al eliminar cliente");
    }
  };

  const getDocLabel = (docType: string, docNumber: string) => {
    if (!docNumber) return "-";
    return `${docType}-${docNumber}`;
  };

  return (
    <div className="space-y-4">
      {/* Stats rapidos */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3">
          <p className="text-2xl font-bold">{clients.length}</p>
          <p className="text-xs text-muted-foreground">Total Clientes</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold">{clients.filter(c => c.type === "natural").length}</p>
          <p className="text-xs text-muted-foreground">Naturales</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold">{clients.filter(c => c.type === "juridico").length}</p>
          <p className="text-xs text-muted-foreground">Juridicos (Empresas)</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold">{clients.filter(c => (c._count?.sales || 0) > 0).length}</p>
          <p className="text-xs text-muted-foreground">Con Compras</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold text-red-600">{clients.filter(c => c.creditBalance > 0).length}</p>
          <p className="text-xs text-muted-foreground">Con Deuda</p>
        </Card>
      </div>

      {/* Busqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <Input
            placeholder="Buscar por nombre, cedula, RIF, telefono..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="natural">Naturales</option>
            <option value="juridico">Juridicos</option>
          </select>
        </div>
        <Button size="sm" onClick={openCreate}>
          + Nuevo Cliente
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportClients('xlsx')} disabled={loading} title="Exportar Excel">
          📊 Excel
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportClients('vcard')} disabled={loading} title="Exportar Contactos (.vcf)">
          📱 Contactos
        </Button>
      </div>

      {/* Estadisticas de Clientes */}
      <div className="mb-2">
        <Button variant="outline" size="sm" onClick={loadClientStats} disabled={statsLoading}>
          {statsLoading ? "Cargando..." : showStats ? "Ocultar Estadisticas" : "Estadisticas de Clientes"}
        </Button>
      </div>

      {showStats && clientStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Top Compradores */}
          <Card className="border-green-200">
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                &#127942; Top {Math.min(10, clientStats.topBuyers?.length || 0)} Mejores Compradores
                <Badge variant="secondary" className="text-[9px]">{clientStats.totalClients} clientes</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-green-50 sticky top-0">
                    <tr>
                      <th className="text-left p-1">#</th>
                      <th className="text-left p-1">Cliente</th>
                      <th className="text-right p-1">Compras</th>
                      <th className="text-right p-1">Total $</th>
                      <th className="text-right p-1">Prom. $</th>
                      <th className="text-right p-1">Frecuencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(clientStats.topBuyers || []).slice(0, 10).map((c: any, i: number) => (
                      <tr key={c.clientId} className="border-t hover:bg-muted/30">
                        <td className="p-1 font-bold">
                          {i === 0 ? '&#129351;' : i === 1 ? '&#129352;' : i === 2 ? '&#129353;' : `${i + 1}`}
                        </td>
                        <td className="p-1">
                          <div className="font-medium">{c.fullName}</div>
                          {c.phone && <div className="text-[9px] text-muted-foreground">{c.phone}</div>}
                        </td>
                        <td className="p-1 text-right font-medium">{c.totalSales}</td>
                        <td className="p-1 text-right font-bold text-green-600">${c.totalUsd.toFixed(2)}</td>
                        <td className="p-1 text-right">${c.avgTicket.toFixed(2)}</td>
                        <td className="p-1 text-right text-muted-foreground">{c.frequencyLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mas Frecuentes */}
          <Card className="border-blue-200">
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                &#128197; Clientes Mas Frecuentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-blue-50 sticky top-0">
                    <tr>
                      <th className="text-left p-1">#</th>
                      <th className="text-left p-1">Cliente</th>
                      <th className="text-right p-1">Compras</th>
                      <th className="text-right p-1">Total $</th>
                      <th className="text-left p-1">Frecuencia</th>
                      <th className="text-right p-1">Ultima Compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(clientStats.topFrequent || []).slice(0, 10).map((c: any, i: number) => (
                      <tr key={c.clientId} className="border-t hover:bg-muted/30">
                        <td className="p-1 font-bold">{i + 1}</td>
                        <td className="p-1">
                          <div className="font-medium">{c.fullName}</div>
                          {c.phone && <div className="text-[9px] text-muted-foreground">{c.phone}</div>}
                        </td>
                        <td className="p-1 text-right font-medium">{c.totalSales}</td>
                        <td className="p-1 text-right font-bold text-blue-600">${c.totalUsd.toFixed(2)}</td>
                        <td className="p-1 text-muted-foreground">{c.frequencyLabel}</td>
                        <td className="p-1 text-right">{new Date(c.lastPurchase).toLocaleDateString('es-VE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de Clientes */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Nombre / Razon Social</th>
                  <th className="text-left p-2 font-medium">Tipo</th>
                  <th className="text-left p-2 font-medium">Cedula / RIF</th>
                  <th className="text-left p-2 font-medium">Telefono</th>
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-right p-2 font-medium">Compras</th>
                  <th className="text-right p-2 font-medium">Deuda</th>
                  <th className="text-right p-2 font-medium">Limite Cred.</th>
                  <th className="text-center p-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client) => (
                  <tr key={client.id} className="border-t hover:bg-muted/30">
                    <td className="p-2">
                      <div className="font-medium">
                        {client.fullName}
                        {client.isFinalClient && (
                          <Badge variant="secondary" className="ml-1 text-[8px]">FINAL</Badge>
                        )}
                      </div>
                      {client.address && (
                        <div className="text-[10px] text-muted-foreground">{client.address}</div>
                      )}
                    </td>
                    <td className="p-2">
                      <Badge variant={client.type === "natural" ? "default" : "success"}>
                        {client.type === "natural" ? "Natural" : "Juridico"}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {getDocLabel(client.docType, client.docNumber)}
                    </td>
                    <td className="p-2 text-xs">{client.phone || "-"}</td>
                    <td className="p-2 text-xs">{client.email || "-"}</td>
                    <td className="p-2 text-right font-medium">
                      {client._count?.sales || 0}
                    </td>
                    <td className="p-2 text-right">
                      {client.creditBalance > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          ${client.creditBalance.toFixed(2)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {client.creditLimit > 0 ? (
                        <span className="text-xs font-medium">${client.creditLimit.toFixed(2)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button variant="ghost" size="sm" onClick={() => loadHistory(client)} className="h-7 text-xs text-blue-600 hover:text-blue-800">
                          Historial
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(client)} className="h-7 text-xs">
                          Editar
                        </Button>
                        {!client.isFinalClient && (
                          <Button variant="ghost" size="sm" onClick={() => deleteClient(client)} className="h-7 text-xs text-destructive">
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-muted-foreground">
                      {loading ? "Cargando..." : "No se encontraron clientes"}
                    </td>
                  </tr>
                )}
                {totalPages > 1 && (
                  <tr><td colSpan={9} className="p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{clients.length} clientes - Pagina {page} de {totalPages}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                        {Array.from({length: totalPages}, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages).map((p, i, arr) => (
                          <Fragment key={p}>
                            {i > 0 && arr[i-1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">...</span>}
                            <Button variant={p === page ? "default" : "outline"} size="sm" className="h-7 w-7 text-xs p-0" onClick={() => setPage(p)}>{p}</Button>
                          </Fragment>
                        ))}
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                      </div>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogo Nuevo/Editar Cliente */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Tipo de persona */}
            <div>
              <Label>Tipo de Persona</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "natural", docType: "V" })}
                  className={`flex-1 p-2 rounded border text-sm font-medium transition-colors ${
                    formData.type === "natural" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  }`}
                >
                  Natural (Persona)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "juridico", docType: "J" })}
                  className={`flex-1 p-2 rounded border text-sm font-medium transition-colors ${
                    formData.type === "juridico" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  }`}
                >
                  Juridico (Empresa)
                </button>
              </div>
            </div>

            {/* Documento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo Documento</Label>
                <select
                  value={formData.docType}
                  onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {DOC_TYPES.filter(d =>
                    formData.type === "natural" ? ["V", "E", "P"].includes(d.value) : ["J", "G", "V"].includes(d.value)
                  ).map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Numero de Documento *</Label>
                <Input
                  value={formData.docNumber}
                  onChange={(e) => setFormData({ ...formData, docNumber: e.target.value.toUpperCase() })}
                  placeholder={formData.type === "natural" ? "12345678" : "00000000-0"}
                />
              </div>
            </div>

            {/* Nombre */}
            {formData.type === "natural" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Primer Nombre *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <Label>Apellido *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Perez"
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label>Razon Social *</Label>
                <Input
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="Mi Empresa C.A."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefono</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+58 412-1234567"
                />
              </div>
              <div>
                <Label>Correo</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <Label>Direccion</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Direccion fiscal o comercial"
              />
            </div>

            <div>
              <Label>Limite de Credito (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                placeholder="0.00 (0 = sin limite)"
              />
            </div>

            {formData.type === "juridico" && (
              <div>
                <Label>Informacion Fiscal Adicional</Label>
                <Input
                  value={formData.taxInfo}
                  onChange={(e) => setFormData({ ...formData, taxInfo: e.target.value })}
                  placeholder="Numero de registro, actividad economica, etc."
                />
              </div>
            )}

            {/* Preview del documento completo */}
            <div className="p-2 bg-muted/50 rounded text-xs">
              <span className="text-muted-foreground">Documento:</span>{" "}
              <span className="font-mono font-bold">
                {formData.docType}-{formData.docNumber || "..."}
              </span>
              <span className="ml-3 text-muted-foreground">Nombre:</span>{" "}
              <span className="font-medium">
                {formData.type === "natural"
                  ? `${formData.firstName} ${formData.lastName}`.trim() || "..."
                  : formData.businessName || "..."}
              </span>
            </div>

            <Button className="w-full" onClick={saveClient} disabled={saving}>
              {saving ? "Guardando..." : editingClient ? "Actualizar Cliente" : "Registrar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL HISTORIAL DE COMPRAS ===== */}
      <Dialog open={!!histClient && !detailSale} onOpenChange={(open) => { if (!open) { setHistClient(null); setHistSales([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Historial de Compras — {histClient?.fullName}
              {histClient?.docNumber && <span className="font-mono text-sm text-muted-foreground ml-2">({histClient.docType}-{histClient.docNumber})</span>}
            </DialogTitle>
          </DialogHeader>

          {/* Filtro por fecha */}
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={histDateFrom} onChange={(e) => setHistDateFrom(e.target.value)} className="h-9 text-sm w-40" />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={histDateTo} onChange={(e) => setHistDateTo(e.target.value)} className="h-9 text-sm w-40" />
            </div>
            <Button size="sm" onClick={filterHistory} disabled={histLoading} className="h-9">Filtrar</Button>
            <Button size="sm" variant="outline" onClick={clearHistFilter} className="h-9">Limpiar</Button>
          </div>

          {/* Resumen dinamico */}
          {histSummary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{histSummary.count}</p>
                <p className="text-[10px] text-muted-foreground">Ventas</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-green-700 dark:text-green-400">{currency} {histSummary.totalUsd.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">Total USD</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">Bs {histSummary.totalBs.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">Total Bs</p>
              </div>
            </div>
          )}

          {/* Lista de ventas */}
          <div className="flex-1 overflow-y-auto">
            {histLoading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando...</p>
            ) : histSales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No se encontraron compras</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Pago</th>
                    <th className="text-right p-2">USD</th>
                    <th className="text-right p-2">Bs</th>
                    <th className="text-center p-2">Estado</th>
                    <th className="text-center p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {histSales.map((sale: any) => {
                    const status = getSaleStatus(sale);
                    return (
                      <tr key={sale.id} className="border-t hover:bg-muted/30">
                        <td className="p-2">
                          <div>{new Date(sale.date).toLocaleDateString('es-VE')}</div>
                          <div className="text-muted-foreground">{new Date(sale.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="p-2">{PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}</td>
                        <td className="p-2 text-right font-medium">{currency} {(sale.total || 0).toFixed(2)}</td>
                        <td className="p-2 text-right font-medium">Bs {(sale.totalBs || 0).toFixed(2)}</td>
                        <td className="p-2 text-center">
                          {status === 'completada' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">COMPLETADA</span>}
                          {status === 'pendiente' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">PENDIENTE</span>}
                          {status === 'vencida' && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">VENCIDA</span>}
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="sm" onClick={() => setDetailSale(sale)} className="h-6 text-[10px] text-blue-600 hover:text-blue-800">Ver</Button>
                            <Button variant="ghost" size="sm" onClick={() => reprintFromHistory(sale)} className="h-6 text-[10px] text-muted-foreground hover:text-foreground">Reimprimir</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL DETALLE DE VENTA ===== */}
      <Dialog open={!!detailSale} onOpenChange={(open) => { if (!open) setDetailSale(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Venta</DialogTitle>
          </DialogHeader>
          {detailSale && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Fecha:</span> {new Date(detailSale.date).toLocaleDateString('es-VE')} {new Date(detailSale.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</div>
                <div><span className="text-muted-foreground">Pago:</span> {PAYMENT_LABELS[detailSale.paymentMethod] || detailSale.paymentMethod}</div>
                <div><span className="text-muted-foreground">Vendedor:</span> {detailSale.sellerName || '-'}</div>
                <div><span className="text-muted-foreground">Tasa:</span> 1$ = {detailSale.exchangeRate} Bs</div>
                {detailSale.referenceNumber && <div className="col-span-2"><span className="text-muted-foreground">Ref:</span> {detailSale.referenceNumber}</div>}
                {detailSale.isCredit && (
                  <>
                    <div><span className="text-muted-foreground">Credito:</span> Pagado {currency} {(detailSale.creditPaid || 0).toFixed(2)} de {currency} {(detailSale.total || 0).toFixed(2)}</div>
                    <div><span className="text-muted-foreground">Vence:</span> {detailSale.creditDueDate ? new Date(detailSale.creditDueDate).toLocaleDateString('es-VE') : '-'}</div>
                  </>
                )}
              </div>
              <Separator />
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">Producto</th>
                    <th className="text-center py-1">Cant</th>
                    <th className="text-right py-1">P.Unit</th>
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailSale.items || []).map((it: any, i: number) => (
                    <tr key={i} className="border-b border-muted/50">
                      <td className="py-1">{it.product?.name || it.productName || ''}</td>
                      <td className="py-1 text-center">{it.quantity}</td>
                      <td className="py-1 text-right">{currency} {(it.unitPrice || 0).toFixed(2)}</td>
                      <td className="py-1 text-right font-medium">{currency} {(it.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Separator />
              <div className="space-y-1 text-xs">
                {detailSale.discount > 0 && <div className="flex justify-between"><span>Descuento:</span><span>-{currency} {detailSale.discount.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-base"><span>TOTAL USD:</span><span>{currency} {(detailSale.total || 0).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base text-amber-600"><span>TOTAL Bs:</span><span>Bs {(detailSale.totalBs || 0).toFixed(2)}</span></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => reprintFromHistory(detailSale)} className="flex-1">Reimprimir</Button>
                <Button size="sm" variant="outline" onClick={() => setDetailSale(null)} className="flex-1">Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
