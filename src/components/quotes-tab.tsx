"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Printer,
  Trash2,
  ArrowRightLeft,
  X,
  Loader2,
  ClipboardList,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuoteItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxType: string;
}

interface Quote {
  id: string;
  number: string;
  clientName: string;
  status: "pendiente" | "aprobada" | "convertida" | "vencida";
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  total: number;
  totalBs: number;
  notes: string;
  validUntil: string;
  createdAt: string;
  createdBy: string;
}

interface QuotesTabProps {
  products: { id: string; name: string; price: number; taxType: string }[];
  bcvRate: number;
  currency: string;
  currentUser: { id: string; fullName: string; role: string; username: string };
  onConvertToSale?: (quote: any) => void;
}

type FilterTab = "pendiente" | "aprobada" | "all";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatBs(amount: number, rate: number): string {
  const converted = amount * rate;
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function calcItemTax(unitPrice: number, quantity: number, taxType: string): number {
  const base = unitPrice * quantity;
  if (taxType === "exento" || taxType === "exento_bcv") return 0;
  if (taxType === "reducido") return base * 0.08;
  return base * 0.16; // general
}

function calcItemTotal(unitPrice: number, quantity: number, taxType: string): number {
  return unitPrice * quantity + calcItemTax(unitPrice, quantity, taxType);
}

function statusConfig(status: Quote["status"]) {
  switch (status) {
    case "pendiente":
      return {
        label: "Pendiente",
        className: "bg-yellow-100 text-yellow-800 border-yellow-300",
      };
    case "aprobada":
      return {
        label: "Aprobada",
        className: "bg-green-100 text-green-800 border-green-300",
      };
    case "convertida":
      return {
        label: "Convertida",
        className: "bg-blue-100 text-blue-800 border-blue-300",
      };
    case "vencida":
      return {
        label: "Vencida",
        className: "bg-red-100 text-red-800 border-red-300",
      };
    default:
      return { label: status, className: "bg-slate-100 text-slate-700 border-slate-300" };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function QuotesTab({
  products,
  bcvRate,
  currency,
  currentUser,
  onConvertToSale,
}: QuotesTabProps) {
  // List state
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("pendiente");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Client selector state
  const [clients, setClients] = useState<Array<{id: string; fullName: string; docType: string; docNumber: string; type: string}>>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // ── Fetch quotes ─────────────────────────────────────────────────────────

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await authFetch(`/api/quotes?${params.toString()}`);
      if (!res.ok) throw new Error("Error cargando presupuestos");
      const data = await res.json();
      setQuotes(data.quotes ?? data.data ?? []);
      setTotalPages(data.totalPages ?? data.total_pages ?? 1);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar presupuestos");
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // ── Fetch registered clients ──────────────────────────────────────────────
  useEffect(() => {
    authFetch("/api/clients?limit=1000")
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const list = Array.isArray(data) ? data : [];
        setClients(list.map((c: any) => ({ id: c.id, fullName: c.fullName, docType: c.docType, docNumber: c.docNumber, type: c.type })));
      })
      .catch(() => {});
  }, []);

  // ── Tab change resets page ───────────────────────────────────────────────

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab);
    setPage(1);
    setExpandedId(null);
  }

  // ── Create quote helpers ─────────────────────────────────────────────────

  function resetCreateForm() {
    setClientName("");
    setClientSearch("");
    setSelectedClientId(null);
    setValidUntil("");
    setNotes("");
    setItems([]);
    setProductSearch("");
  }

  function openCreateDialog() {
    resetCreateForm();
    // Default valid-until: 15 days from now
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setValidUntil(d.toISOString().split("T")[0]);
    setCreateOpen(true);
  }

  function addProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          taxType: product.taxType,
        },
      ]);
    }
    setProductSearch("");
  }

  function updateItemQuantity(productId: string, qty: number) {
    if (qty < 1) return;
    setItems(items.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)));
  }

  function removeItem(productId: string) {
    setItems(items.filter((i) => i.productId !== productId));
  }

  const createSubtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const createTax = items.reduce(
    (s, i) => s + calcItemTax(i.unitPrice, i.quantity, i.taxType),
    0
  );
  const createTotal = createSubtotal + createTax;

  // ── Client selector helpers ──────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 15);
    const q = clientSearch.toLowerCase();
    return clients.filter(c =>
      c.fullName.toLowerCase().includes(q) || c.docNumber.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [clients, clientSearch]);

  function selectClient(client: typeof clients[0]) {
    setClientName(client.fullName);
    setSelectedClientId(client.id);
    setClientSearch(client.fullName);
    setShowClientDropdown(false);
  }

  async function handleCreateQuote() {
    if (!clientName.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    if (!validUntil) {
      toast.error("La fecha de validez es obligatoria");
      return;
    }
    if (items.length === 0) {
      toast.error("Debe agregar al menos un producto");
      return;
    }

    setCreateLoading(true);
    try {
      const res = await authFetch("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientId: selectedClientId,
          validUntil,
          notes: notes.trim(),
          items: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxType: i.taxType,
          })),
          subtotal: createSubtotal,
          tax: createTax,
          total: createTotal,
          totalBs: createTotal * bcvRate,
          createdBy: currentUser.id,
          createdByName: currentUser.fullName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Error al crear presupuesto");
      }

      toast.success("Presupuesto creado exitosamente");
      setCreateOpen(false);
      resetCreateForm();
      fetchQuotes();
    } catch (err: any) {
      toast.error(err.message || "Error al crear presupuesto");
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Quote actions ────────────────────────────────────────────────────────

  async function handleConvertToSale(quote: Quote) {
    try {
      const res = await authFetch("/api/quotes", {
        method: "PUT",
        body: JSON.stringify({ id: quote.id, action: "convert_to_sale" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al convertir");
      }
      toast.success("Presupuesto convertido a venta");
      onConvertToSale?.(quote);
      fetchQuotes();
    } catch (err: any) {
      toast.error(err.message || "Error al convertir presupuesto");
    }
  }

  async function handleDeleteQuote(quote: Quote) {
    if (!window.confirm(`¿Eliminar presupuesto ${quote.number}?`)) return;
    try {
      const res = await authFetch(`/api/quotes?id=${quote.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Presupuesto eliminado");
      if (expandedId === quote.id) setExpandedId(null);
      fetchQuotes();
    } catch {
      toast.error("Error al eliminar presupuesto");
    }
  }

  function handlePrint(quote: Quote) {
    const taxLabel = (item: QuoteItem) => {
      if (item.taxType === "exento" || item.taxType === "exento_bcv") return "Exento";
      if (item.taxType === "reducido") return "8%";
      return "16%";
    };

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <title>Presupuesto ${quote.number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { color: #64748b; font-size: 13px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 13px; }
          th { background: #f1f5f9; font-weight: 600; }
          .totals { text-align: right; margin-top: 12px; }
          .totals div { margin-bottom: 4px; font-size: 14px; }
          .totals .grand { font-size: 18px; font-weight: 700; }
          .notes { margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 13px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Presupuesto ${quote.number}</h1>
        <div class="meta">
          <p>Cliente: <strong>${quote.clientName}</strong></p>
          <p>Fecha: ${formatDate(quote.createdAt)} &nbsp;|&nbsp; Válido hasta: ${formatDate(quote.validUntil)}</p>
          <p>Elaborado por: ${quote.createdBy}</p>
        </div>
        <table>
          <thead>
            <tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Imp.</th><th>Total</th></tr>
          </thead>
          <tbody>
            ${quote.items
              .map(
                (i) =>
                  `<tr>
                    <td>${i.productName}</td>
                    <td>${i.quantity}</td>
                    <td>${formatUSD(i.unitPrice)}</td>
                    <td>${taxLabel(i)}</td>
                    <td>${formatUSD(calcItemTotal(i.unitPrice, i.quantity, i.taxType))}</td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="totals">
          <div>Subtotal: ${formatUSD(quote.subtotal)}</div>
          <div>Impuesto: ${formatUSD(quote.tax)}</div>
          <div class="grand">Total: ${formatUSD(quote.total)}</div>
          <div style="color:#64748b;">Total Bs: Bs. ${formatBs(quote.total, bcvRate)}</div>
        </div>
        ${quote.notes ? `<div class="notes"><strong>Notas:</strong> ${quote.notes}</div>` : ""}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  // ── Filtered products for search ─────────────────────────────────────────

  const filteredProducts = products.filter((p) => {
    const s = productSearch.toLowerCase();
    return p.name?.toLowerCase().includes(s)
      || (p.barcode || '').toLowerCase().includes(s)
      || (p.secondaryBarcode || '').toLowerCase().includes(s)
      || (p.brand?.name || '').toLowerCase().includes(s)
      || (p.category?.name || '').toLowerCase().includes(s);
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">
            Presupuestos / Cotizaciones
          </h2>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Presupuesto
        </Button>
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {([
          { key: "pendiente" as FilterTab, label: "Pendientes" },
          { key: "aprobada" as FilterTab, label: "Aprobadas" },
          { key: "all" as FilterTab, label: "Todas" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Quote List ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <span className="text-sm">Cargando presupuestos...</span>
        </div>
      ) : quotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ClipboardList className="h-12 w-12 mb-3" />
            <p className="text-base font-medium text-slate-500">
              No hay presupuestos
            </p>
            <p className="text-sm mt-1">
              {activeTab === "all"
                ? "Crea tu primer presupuesto"
                : `No hay presupuestos ${activeTab === "pendiente" ? "pendientes" : "aprobadas"}`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const sc = statusConfig(quote.status);
            const isExpanded = expandedId === quote.id;
            return (
              <Card key={quote.id} className="overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  {/* Quote header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Left info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">
                          {quote.number}
                        </span>
                        <Badge
                          variant="outline"
                          className={sc.className}
                        >
                          {sc.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{formatDate(quote.createdAt)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Válido hasta {formatDate(quote.validUntil)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1 truncate">
                        Cliente: {quote.clientName}
                      </p>
                    </div>

                    {/* Totals */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-slate-800">
                        {formatUSD(quote.total)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Bs. {formatBs(quote.total, bcvRate)}
                      </p>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : quote.id)
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {isExpanded ? "Ocultar" : "Ver Detalles"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => handlePrint(quote)}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimir
                    </Button>

                    {quote.status === "pendiente" && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleConvertToSale(quote)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Convertir a Venta
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => handleDeleteQuote(quote)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4">
                      <Separator className="mb-4" />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 pr-3 font-medium text-slate-500">
                                Producto
                              </th>
                              <th className="text-center py-2 px-2 font-medium text-slate-500">
                                Cant.
                              </th>
                              <th className="text-right py-2 px-2 font-medium text-slate-500">
                                P. Unit.
                              </th>
                              <th className="text-center py-2 px-2 font-medium text-slate-500">
                                Imp.
                              </th>
                              <th className="text-right py-2 pl-2 font-medium text-slate-500">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {quote.items.map((item) => {
                              const itemTaxLabel =
                                item.taxType === "exento" ||
                                item.taxType === "exento_bcv"
                                  ? "Exento"
                                  : item.taxType === "reducido"
                                    ? "8%"
                                    : "16%";
                              return (
                                <tr
                                  key={item.productId}
                                  className="border-b border-slate-100"
                                >
                                  <td className="py-2 pr-3 text-slate-700">
                                    {item.productName}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-600">
                                    {item.quantity}
                                  </td>
                                  <td className="py-2 px-2 text-right text-slate-600">
                                    {formatUSD(item.unitPrice)}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-500">
                                    {itemTaxLabel}
                                  </td>
                                  <td className="py-2 pl-2 text-right font-medium text-slate-800">
                                    {formatUSD(
                                      calcItemTotal(
                                        item.unitPrice,
                                        item.quantity,
                                        item.taxType
                                      )
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals block */}
                      <div className="flex flex-col items-end gap-1 mt-4 text-sm">
                        <div className="flex justify-between w-full max-w-xs">
                          <span className="text-slate-500">Subtotal:</span>
                          <span className="text-slate-700">
                            {formatUSD(quote.subtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between w-full max-w-xs">
                          <span className="text-slate-500">Impuesto:</span>
                          <span className="text-slate-700">
                            {formatUSD(quote.tax)}
                          </span>
                        </div>
                        <Separator className="w-full max-w-xs my-1" />
                        <div className="flex justify-between w-full max-w-xs">
                          <span className="font-semibold text-slate-800">
                            Total:
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatUSD(quote.total)}
                          </span>
                        </div>
                        <div className="flex justify-between w-full max-w-xs">
                          <span className="text-slate-500">Total Bs:</span>
                          <span className="text-slate-600">
                            Bs. {formatBs(quote.total, bcvRate)}
                          </span>
                        </div>
                      </div>

                      {quote.notes && (
                        <div className="mt-4 p-3 bg-slate-50 rounded-md text-sm text-slate-600">
                          <span className="font-medium text-slate-700">
                            Notas:
                          </span>{" "}
                          {quote.notes}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {!loading && quotes.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-600">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* ── Create Quote Dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-600" />
              Nuevo Presupuesto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Client & dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="q-client">Cliente *</Label>
                <div className="relative">
                  <Input
                    id="q-client"
                    placeholder="Buscar cliente registrado o escribir nombre..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setClientName(e.target.value);
                      setSelectedClientId(null);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  />
                  {showClientDropdown && filteredClients.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-background shadow-lg">
                      {filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between border-b last:border-0 transition-colors cursor-pointer"
                          onMouseDown={(e) => { e.preventDefault(); selectClient(c); }}
                        >
                          <div>
                            <span className="font-medium">{c.fullName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{c.docType}-{c.docNumber}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedClientId && (
                  <p className="text-xs text-muted-foreground">Cliente seleccionado: {clientName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-valid">Válido hasta *</Label>
                <Input
                  id="q-valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="q-notes">Notas</Label>
              <Textarea
                id="q-notes"
                placeholder="Notas adicionales (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            {/* Product search & add */}
            <div className="space-y-2">
              <Label>Agregar Producto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nombre, codigo, marca, categoria..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              {productSearch && (
                <div className="border rounded-md max-h-48 overflow-y-auto bg-white shadow-sm">
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-slate-400 p-3">
                      No se encontraron productos
                    </p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        onClick={() => addProduct(p.id)}
                      >
                        <div className="truncate">
                          <span className="text-slate-700">{p.name}</span>
                          {(p.brand?.name || p.category?.name) && (
                            <span className="text-slate-400 text-xs ml-1">{p.brand?.name ? p.brand.name : ''}{p.brand?.name && p.category?.name ? ' · ' : ''}{p.category?.name || ''}</span>
                          )}
                        </div>
                        <span className="text-slate-500 flex-shrink-0">
                          {formatUSD(p.price)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="text-left py-2.5 px-3 font-medium text-slate-500">
                          Producto
                        </th>
                        <th className="text-center py-2.5 px-2 font-medium text-slate-500">
                          Cant.
                        </th>
                        <th className="text-right py-2.5 px-2 font-medium text-slate-500">
                          P. Unit.
                        </th>
                        <th className="text-center py-2.5 px-2 font-medium text-slate-500">
                          Imp.
                        </th>
                        <th className="text-right py-2.5 px-3 font-medium text-slate-500">
                          Total
                        </th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const taxLabel =
                          item.taxType === "exento" ||
                          item.taxType === "exento_bcv"
                            ? "Exento"
                            : item.taxType === "reducido"
                              ? "8%"
                              : "16%";
                        return (
                          <tr
                            key={item.productId}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="py-2 px-3 text-slate-700">
                              {item.productName}
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItemQuantity(
                                    item.productId,
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="w-16 text-center h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2 text-right text-slate-600">
                              {formatUSD(item.unitPrice)}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-500 text-xs">
                              {taxLabel}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-800">
                              {formatUSD(
                                calcItemTotal(
                                  item.unitPrice,
                                  item.quantity,
                                  item.taxType
                                )
                              )}
                            </td>
                            <td className="py-2 pr-2">
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                onClick={() => removeItem(item.productId)}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals */}
            {items.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col items-end gap-1.5 text-sm">
                  <div className="flex justify-between w-full max-w-xs">
                    <span className="text-slate-500">Subtotal:</span>
                    <span className="text-slate-700">
                      {formatUSD(createSubtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between w-full max-w-xs">
                    <span className="text-slate-500">Impuesto:</span>
                    <span className="text-slate-700">
                      {formatUSD(createTax)}
                    </span>
                  </div>
                  <Separator className="w-full max-w-xs" />
                  <div className="flex justify-between w-full max-w-xs">
                    <span className="font-semibold text-slate-800">Total:</span>
                    <span className="font-bold text-slate-900">
                      {formatUSD(createTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between w-full max-w-xs">
                    <span className="text-slate-500">Total Bs:</span>
                    <span className="text-slate-600">
                      Bs. {formatBs(createTotal, bcvRate)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Save button */}
            <Button
              className="w-full gap-2"
              onClick={handleCreateQuote}
              disabled={createLoading}
            >
              {createLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {createLoading ? "Guardando..." : "Guardar Presupuesto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
