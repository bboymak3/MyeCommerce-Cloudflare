"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Printer,
  Loader2,
  AlertTriangle,
  Truck,
  FileText,
  Package,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeliveryNotesTabProps {
  products: { id: string; name: string; stock: number; cost: number }[];
  bcvRate: number;
  currency: string;
  currentUser: { id: string; fullName: string; role: string; username: string };
}

interface NoteItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  currentStock: number;
}

interface DeliveryNote {
  id: string;
  number: string;
  date: string;
  recipientName: string;
  recipientDoc: string;
  recipientAddress: string;
  reason: string;
  notes: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
  }[];
  totalItems: number;
  totalUsd: number;
  status: "emitida" | "recibida" | "anulada";
  createdBy: string;
  createdAt: string;
  receivedBy?: string;
  receivedAt?: string;
  anuladaBy?: string;
  anuladaAt?: string;
}

type StatusFilter = "emitida" | "recibida" | "anulada" | "todas";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-VE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function statusBadgeVariant(status: string): "warning" | "success" | "destructive" | "default" {
  if (status === "emitida") return "warning";
  if (status === "recibida") return "success";
  if (status === "anulada") return "destructive";
  return "default";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    emitida: "Emitida",
    recibida: "Recibida",
    anulada: "Anulada",
  };
  return map[status] || status;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DeliveryNotesTab({
  products,
  bcvRate,
  currency,
  currentUser,
}: DeliveryNotesTabProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("todas");
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientDoc, setRecipientDoc] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [reason, setReason] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<NoteItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // ── Fetch notes ───────────────────────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== "todas") params.set("status", activeFilter);
      const res = await authFetch(`/api/delivery-notes?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar notas de entrega");
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : data.notes ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar notas de entrega");
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.number.toLowerCase().includes(q) ||
        n.recipientName.toLowerCase().includes(q) ||
        n.reason.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const summary = useMemo(() => {
    const allNotes = notes;
    return {
      emitidas: allNotes.filter((n) => n.status === "emitida").length,
      recibidas: allNotes.filter((n) => n.status === "recibida").length,
      anuladas: allNotes.filter((n) => n.status === "anulada").length,
    };
  }, [notes]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  // ── Create dialog ──────────────────────────────────────────────────────────
  const openCreateDialog = () => {
    setRecipientName("");
    setRecipientDoc("");
    setRecipientAddress("");
    setReason("");
    setCreateNotes("");
    setSelectedItems([]);
    setProductSearch("");
    setCreating(false);
    setShowProductDropdown(false);
    setCreateOpen(true);
  };

  const addItemToNote = (product: { id: string; name: string; stock: number; cost: number }) => {
    const already = selectedItems.find((i) => i.productId === product.id);
    if (already) {
      toast.info("El producto ya está en la lista");
      return;
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: product.cost,
        currentStock: product.stock,
      },
    ]);
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const updateItemQty = (productId: string, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        const product = products.find((p) => p.id === productId);
        const currentStock = product?.stock ?? item.currentStock;
        const clampedQty = Math.max(0, Math.min(qty, currentStock));
        return item.productId === productId ? { ...item, quantity: clampedQty } : item;
      })
    );
  };

  const removeItemFromNote = (productId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const createTotalUsd = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0),
    [selectedItems]
  );

  const createTotalBs = useMemo(() => createTotalUsd * bcvRate, [createTotalUsd, bcvRate]);

  const handleCreate = async () => {
    if (!recipientName.trim()) {
      toast.error("El nombre del destinatario es requerido");
      return;
    }
    if (!reason.trim()) {
      toast.error("La razón / destino es requerida");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Debe agregar al menos un producto");
      return;
    }
    for (const item of selectedItems) {
      if (item.quantity <= 0) {
        toast.error(`La cantidad de "${item.productName}" debe ser mayor a 0`);
        return;
      }
    }

    const confirmed = window.confirm(
      "⚠️ CONFIRMACIÓN IMPORTANTE:\n\n" +
      "Las Notas de Entrega RESTAN del inventario real y generan movimiento en el Kardex.\n" +
      "El stock de los productos será afectado inmediatamente.\n\n" +
      "¿Desea continuar?"
    );
    if (!confirmed) return;

    setCreating(true);
    try {
      const res = await authFetch("/api/delivery-notes", {
        method: "POST",
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientDoc: recipientDoc.trim(),
          recipientAddress: recipientAddress.trim(),
          reason: reason.trim(),
          notes: createNotes.trim(),
          items: selectedItems.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitCost: i.unitCost,
          })),
          createdBy: currentUser.id,
          createdByName: currentUser.fullName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Error al crear nota");
      }
      toast.success("Nota de Entrega creada exitosamente");
      setCreateOpen(false);
      fetchNotes();
    } catch (err: any) {
      toast.error(err.message || "Error al crear nota de entrega");
    } finally {
      setCreating(false);
    }
  };

  // ── Status actions ────────────────────────────────────────────────────────
  const handleMarkReceived = async (note: DeliveryNote) => {
    if (!window.confirm(`¿Marcar la Nota #${note.number} como Recibida?`)) return;
    try {
      const res = await authFetch("/api/delivery-notes", {
        method: "PUT",
        body: JSON.stringify({ id: note.id, status: "recibida", receivedBy: currentUser.id }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Nota #${note.number} marcada como Recibida`);
      fetchNotes();
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const handleAnular = async (note: DeliveryNote) => {
    const confirmed = window.confirm(
      `⚠️ ANULAR Nota #${note.number}\n\n` +
      "Esta acción restaurará el stock de los productos al inventario.\n" +
      "Se generará un movimiento en el Kardex.\n\n" +
      "¿Está seguro de que desea anular esta nota?"
    );
    if (!confirmed) return;
    try {
      const res = await authFetch("/api/delivery-notes", {
        method: "PUT",
        body: JSON.stringify({ id: note.id, status: "anulada", anuladaBy: currentUser.id }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Nota #${note.number} anulada — stock restaurado`);
      fetchNotes();
    } catch {
      toast.error("Error al anular nota de entrega");
    }
  };

  const handleDelete = async (note: DeliveryNote) => {
    if (
      !window.confirm(
        `⚠️ ¿ELIMINAR Nota #${note.number}?\n\nEsta acción no se puede deshacer.`
      )
    )
      return;
    try {
      const res = await authFetch(`/api/delivery-notes?id=${note.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success(`Nota #${note.number} eliminada`);
      fetchNotes();
    } catch {
      toast.error("Error al eliminar nota de entrega");
    }
  };

  const handlePrint = (note: DeliveryNote) => {
    const totalBs = note.totalUsd * bcvRate;
    const printContent = `
      <html>
        <head>
          <title>Nota de Entrega #${note.number}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; color: #1e293b; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
            .subtitle { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 11px; }
            th { background: #f1f5f9; font-weight: 600; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
            .info-label { font-weight: 600; color: #475569; }
            .totals { margin-top: 16px; text-align: right; }
            .totals p { margin: 2px 0; font-size: 12px; }
            .totals .grand { font-size: 14px; font-weight: 700; }
            .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
            .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          <h1>NOTA DE ENTREGA #${note.number}</h1>
          <div class="subtitle">Generada el ${formatDate(note.date)}</div>
          <div class="info-grid">
            <div><span class="info-label">Destinatario:</span> ${note.recipientName}</div>
            <div><span class="info-label">Documento:</span> ${note.recipientDoc || "—"}</div>
            <div><span class="info-label">Dirección:</span> ${note.recipientAddress || "—"}</div>
            <div><span class="info-label">Estado:</span> <span class="status-badge">${statusLabel(note.status)}</span></div>
            <div><span class="info-label">Razón/Destino:</span> ${note.reason}</div>
            <div><span class="info-label">Creada por:</span> ${note.createdBy || ""}</div>
          </div>
          ${note.notes ? `<p style="font-size:11px;color:#475569;"><strong>Notas:</strong> ${note.notes}</p>` : ""}
          <table>
            <thead>
              <tr><th>#</th><th>Producto</th><th>Cantidad</th><th>Costo Unit.</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${note.items
                .map(
                  (it, idx) =>
                    `<tr><td>${idx + 1}</td><td>${it.productName}</td><td>${it.quantity}</td><td>${formatCurrency(it.unitCost)}</td><td>${formatCurrency(it.quantity * it.unitCost)}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
          <div class="totals">
            <p><strong>Total Items:</strong> ${note.totalItems}</p>
            <p><strong>Total USD:</strong> ${formatCurrency(note.totalUsd)}</p>
            <p><strong>Total ${currency}:</strong> ${formatCurrency(totalBs)} <span style="font-size:10px;color:#94a3b8;">(Tasa BCV: ${bcvRate.toFixed(2)})</span></p>
            <p class="grand">TOTAL: ${formatCurrency(note.totalUsd)}</p>
          </div>
          <div class="footer">Impreso el ${new Date().toLocaleString("es-VE")} — ${currentUser.fullName}</div>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.print();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Warning Banner ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow-400 bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-600 dark:text-yellow-200">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <p className="text-sm font-medium leading-relaxed">
          Las Notas de Entrega{" "}
          <strong>RESTAN del inventario real</strong> y generan movimiento en
          el Kardex. Revise los montos y cantidades antes de confirmar.
        </p>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-yellow-400">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
              <FileText className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Emitidas</p>
              <p className="text-2xl font-bold">{summary.emitidas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recibidas</p>
              <p className="text-2xl font-bold">{summary.recibidas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-400">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Anuladas</p>
              <p className="text-2xl font-bold">{summary.anuladas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Tabs & Actions ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Tabs value={activeFilter} setActiveTab={(v: string) => setActiveFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="todas" activeTab={activeFilter} setActiveTab={(v: string) => setActiveFilter(v as StatusFilter)}>
              Todas
            </TabsTrigger>
            <TabsTrigger value="emitida" activeTab={activeFilter} setActiveTab={(v: string) => setActiveFilter(v as StatusFilter)}>
              Emitidas
            </TabsTrigger>
            <TabsTrigger value="recibida" activeTab={activeFilter} setActiveTab={(v: string) => setActiveFilter(v as StatusFilter)}>
              Recibidas
            </TabsTrigger>
            <TabsTrigger value="anulada" activeTab={activeFilter} setActiveTab={(v: string) => setActiveFilter(v as StatusFilter)}>
              Anuladas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-56"
            />
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Nueva Nota de Entrega</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      {/* ── Notes List ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p className="text-sm">Cargando notas de entrega...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Truck className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No hay notas de entrega</p>
            <p className="text-sm mt-1">
              {searchQuery
                ? "No se encontraron resultados para su búsqueda."
                : activeFilter !== "todas"
                  ? `No hay notas con estado "${statusLabel(activeFilter)}".`
                  : "Cree una nueva nota de entrega para comenzar."}
            </p>
            {!searchQuery && (
              <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Nota de Entrega
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto pr-1 custom-scrollbar">
          {filteredNotes.map((note) => {
            const isExpanded = expandedId === note.id;
            const totalBs = note.totalUsd * bcvRate;

            return (
              <Card key={note.id} className="overflow-hidden transition-all hover:shadow-md">
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Left: Note Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                        <Package className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">
                            Nota #{note.number}
                          </span>
                          <Badge variant={statusBadgeVariant(note.status)}>
                            {statusLabel(note.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {note.recipientName} — {note.reason}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{formatDate(note.date)}</span>
                          <span>{note.totalItems} item{note.totalItems !== 1 ? "s" : ""}</span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(note.totalUsd)}
                          </span>
                          <span className="text-xs">
                            {formatCurrency(totalBs)} {currency}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : note.id)}
                        title="Ver Detalles"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 mr-1" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-1" />
                        )}
                        <Eye className="h-4 w-4" />
                      </Button>

                      {note.status === "emitida" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkReceived(note)}
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Recibida</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnular(note)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Anular</span>
                          </Button>
                        </>
                      )}

                      <Button variant="ghost" size="sm" onClick={() => handlePrint(note)} title="Imprimir">
                        <Printer className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(note)}
                        className="text-destructive hover:bg-destructive/10"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <>
                    <Separator />
                    <div className="p-4 bg-muted/30">
                      {/* Recipient Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Destinatario:</span>{" "}
                          <span className="font-medium">{note.recipientName}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Documento:</span>{" "}
                          <span className="font-medium">{note.recipientDoc || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Dirección:</span>{" "}
                          <span className="font-medium">{note.recipientAddress || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Razón/Destino:</span>{" "}
                          <span className="font-medium">{note.reason}</span>
                        </div>
                        {note.receivedBy && (
                          <div>
                            <span className="text-muted-foreground">Recibida por:</span>{" "}
                            <span className="font-medium">{note.receivedBy}</span>
                          </div>
                        )}
                        {note.anuladaBy && (
                          <div>
                            <span className="text-muted-foreground">Anulada por:</span>{" "}
                            <span className="font-medium">{note.anuladaBy}</span>
                          </div>
                        )}
                      </div>

                      {note.notes && (
                        <div className="mb-4 text-sm">
                          <span className="text-muted-foreground">Notas:</span>{" "}
                          <span>{note.notes}</span>
                        </div>
                      )}

                      {/* Items Table */}
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted">
                              <th className="text-left p-2 font-medium">#</th>
                              <th className="text-left p-2 font-medium">Producto</th>
                              <th className="text-right p-2 font-medium">Cantidad</th>
                              <th className="text-right p-2 font-medium">Costo Unit.</th>
                              <th className="text-right p-2 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {note.items.map((item, idx) => (
                              <tr key={item.productId} className="border-t">
                                <td className="p-2 text-muted-foreground">{idx + 1}</td>
                                <td className="p-2 font-medium">{item.productName}</td>
                                <td className="p-2 text-right">{item.quantity}</td>
                                <td className="p-2 text-right">{formatCurrency(item.unitCost)}</td>
                                <td className="p-2 text-right font-medium">
                                  {formatCurrency(item.quantity * item.unitCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals */}
                      <div className="flex flex-col items-end mt-3 text-sm gap-1">
                        <div className="flex items-center gap-6">
                          <span className="text-muted-foreground">
                            Total Items: <strong>{note.totalItems}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Total USD: <strong>{formatCurrency(note.totalUsd)}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Total {currency}: <strong>{formatCurrency(totalBs)}</strong>{" "}
                            <span className="text-xs">(Tasa: {bcvRate.toFixed(2)})</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Nueva Nota de Entrega
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Warning inside dialog */}
            <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-700 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Esta nota RESTARÁ del inventario real y generará movimiento en el
                Kardex al guardar.
              </span>
            </div>

            {/* Recipient Info */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Datos del Destinatario
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="recipientName">Nombre *</Label>
                  <Input
                    id="recipientName"
                    placeholder="Nombre completo"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="recipientDoc">Documento / RIF</Label>
                  <Input
                    id="recipientDoc"
                    placeholder="Ej: V-12345678"
                    value={recipientDoc}
                    onChange={(e) => setRecipientDoc(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="recipientAddress">Dirección</Label>
                <Input
                  id="recipientAddress"
                  placeholder="Dirección de entrega"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Reason */}
            <div className="space-y-1">
              <Label htmlFor="reason">Razón / Destino *</Label>
              <Input
                id="reason"
                placeholder="Motivo de la entrega o destino"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="createNotes">Notas</Label>
              <Textarea
                id="createNotes"
                placeholder="Notas adicionales..."
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            {/* Product Selector */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Productos
              </h4>

              {/* Product search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto por nombre..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  className="pl-9"
                />

                {/* Dropdown */}
                {showProductDropdown && productSearch.trim() && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-background shadow-lg">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        No se encontraron productos
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between border-b last:border-0"
                          onClick={() => addItemToNote(p)}
                          disabled={p.stock <= 0}
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              Stock: {p.stock}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(p.cost)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Click outside to close dropdown */}
              {showProductDropdown && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProductDropdown(false)}
                />
              )}

              {/* Items Table */}
              {selectedItems.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left p-2 font-medium">Producto</th>
                        <th className="text-right p-2 font-medium">Stock Actual</th>
                        <th className="text-right p-2 font-medium">Cantidad</th>
                        <th className="text-right p-2 font-medium">Costo Unit.</th>
                        <th className="text-right p-2 font-medium">Total</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => {
                        const total = item.quantity * item.unitCost;
                        const isOverStock = item.quantity > item.currentStock;
                        return (
                          <tr
                            key={item.productId}
                            className={`border-t ${isOverStock ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                          >
                            <td className="p-2 font-medium">{item.productName}</td>
                            <td className="p-2 text-right text-muted-foreground">
                              {item.currentStock}
                            </td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                min={0}
                                max={item.currentStock}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItemQty(item.productId, parseInt(e.target.value) || 0)
                                }
                                className={`w-20 text-right h-8 text-sm ${
                                  isOverStock ? "border-red-400 bg-red-50 dark:bg-red-950/20" : ""
                                }`}
                              />
                            </td>
                            <td className="p-2 text-right">{formatCurrency(item.unitCost)}</td>
                            <td className="p-2 text-right font-medium">
                              {formatCurrency(total)}
                            </td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => removeItemFromNote(item.productId)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedItems.length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Busque y agregue productos arriba
                </div>
              )}
            </div>

            {/* Totals */}
            {selectedItems.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Total Items:</span>{" "}
                      <strong>{selectedItems.length}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Total USD:</span>{" "}
                      <strong>{formatCurrency(createTotalUsd)}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        Total {currency}:
                      </span>{" "}
                      <strong>{formatCurrency(createTotalBs)}</strong>{" "}
                      <span className="text-xs text-muted-foreground">
                        (Tasa: {bcvRate.toFixed(2)})
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Guardar Nota de Entrega
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
