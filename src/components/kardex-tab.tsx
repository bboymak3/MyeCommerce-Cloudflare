"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import {
  Search,
  Download,
  Loader2,
  FileText,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  BookOpen,
  CalendarDays,
  User,
  ChevronDown,
  Filter,
  PackageSearch,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KardexTabProps {
  products: { id: string; name: string; cost: number; stock: number }[];
  bcvRate: number;
  currency: string;
  currentUser?: { fullName: string; role: string; username: string };
}

interface KardexMovement {
  id: string;
  date: string;
  movementType: string;
  concept: string;
  quantity: number;
  absQuantity: number;
  unitCost: number;
  totalCost: number;
  balanceQty: number;
  balanceTotalCost: number;
  balanceAvgCost: number;
  userId: string;
  userName: string;
  userRole: string;
  referenceId: string;
}

interface KardexSummary {
  initialBalance: { qty: number; totalCost: number; avgCost: number };
  finalBalance: { qty: number; totalCost: number; avgCost: number };
  totalEntries: number;
  totalExits: number;
}

interface KardexResponse {
  movements: KardexMovement[];
  summary: KardexSummary;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  message?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  venta: "Venta",
  compra: "Compra",
  devolucion: "Devolución",
  ajuste_entrada: "Ajuste Entrada",
  ajuste_salida: "Ajuste Salida",
  merma: "Merma",
  nota_entrega: "Nota de Entrega",
};

const ENTRY_TYPES = new Set(["compra", "devolucion", "ajuste_entrada"]);
const EXIT_TYPES = new Set(["venta", "ajuste_salida", "merma", "nota_entrega"]);

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  venta: "bg-red-100 text-red-800 border-red-200",
  compra: "bg-green-100 text-green-800 border-green-200",
  devolucion: "bg-blue-100 text-blue-800 border-blue-200",
  ajuste_entrada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ajuste_salida: "bg-orange-100 text-orange-800 border-orange-200",
  merma: "bg-yellow-100 text-yellow-800 border-yellow-200",
  nota_entrega: "bg-purple-100 text-purple-800 border-purple-200",
};

function formatCurrency(value: number, rate: number, currency: string): string {
  const amount = value * rate;
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

// ─── Helper: default date range ─────────────────────────────────────────────

function getDefaultDates(): { startDate: string; endDate: string } {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  return {
    startDate: thirtyDaysAgo.toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KardexTab({
  products,
  bcvRate,
  currency,
  currentUser,
}: KardexTabProps) {
  const defaults = getDefaultDates();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [startDate, setStartDate] = useState<string>(defaults.startDate);
  const [endDate, setEndDate] = useState<string>(defaults.endDate);
  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [summary, setSummary] = useState<KardexSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState<string>("");

  // ── Product dropdown ───────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 20);
    const q = productSearch.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, productSearch]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // ── Fetch kardex ───────────────────────────────────────────────────────────
  const fetchKardex = useCallback(async () => {
    if (!selectedProductId) {
      toast.error("Seleccione un producto para consultar el kardex");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Seleccione un rango de fechas válido");
      return;
    }

    setLoading(true);
    setSearched(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        productId: selectedProductId,
        startDate,
        endDate,
        limit: "1000",
      });
      const res = await authFetch(`/api/kardex?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        const typed = data as KardexResponse;
        setMovements(typed.movements || []);
        setSummary(typed.summary || null);
        setMessage(typed.message || "");
      } else {
        toast.error(data.error || "Error al obtener el kardex");
        setMovements([]);
        setSummary(null);
      }
    } catch (err) {
      console.error("Error fetching kardex:", err);
      toast.error("Error de conexión al obtener el kardex");
      setMovements([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, startDate, endDate]);

  // ── Select product ────────────────────────────────────────────────────────
  const handleSelectProduct = useCallback((product: typeof products[0]) => {
    setSelectedProductId(product.id);
    setProductSearch(product.name);
    setShowProductDropdown(false);
  }, []);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (movements.length === 0) {
      toast.error("No hay movimientos para exportar");
      return;
    }

    const headers = [
      "#",
      "Fecha",
      "Hora",
      "Concepto",
      "Tipo",
      "Usuario",
      "Entrada",
      "Salida",
      "Saldo Qty",
      "Costo Promedio",
      "Costo Total",
    ];

    const rows = movements.map((m, i) => {
      const entry = ENTRY_TYPES.has(m.movementType) ? m.absQuantity : "";
      const exit = EXIT_TYPES.has(m.movementType) ? m.absQuantity : "";
      return [
        i + 1,
        formatDate(m.date),
        formatTime(m.date),
        `"${m.concept || MOVEMENT_TYPE_LABELS[m.movementType] || m.movementType}"`,
        `"${MOVEMENT_TYPE_LABELS[m.movementType] || m.movementType}"`,
        `"${m.userName || m.userId}"`,
        entry,
        exit,
        m.balanceQty,
        m.balanceAvgCost.toFixed(2),
        m.balanceTotalCost.toFixed(2),
      ];
    });

    const productName = selectedProduct?.name || "producto";
    const csvContent = [
      `"Kardex - ${productName}"`,
      `"Desde: ${startDate} | Hasta: ${endDate}"`,
      `"Generado por: ${currentUser?.fullName || "N/A"} | ${new Date().toLocaleString("es-VE")}"`,
      "",
      headers.join(","),
      ...rows.map((r) => r.join(",")),
      "",
      `"RESUMEN"`,
      `"Stock Inicial","${summary?.initialBalance.qty || 0}"`,
      `"Total Entradas","${summary?.totalEntries || 0}"`,
      `"Total Salidas","${summary?.totalExits || 0}"`,
      `"Stock Final","${summary?.finalBalance.qty || 0}"`,
      `"Costo Promedio Final","${summary?.finalBalance.avgCost?.toFixed(2) || "0.00"}"`,
      `"Costo Total Final","${summary?.finalBalance.totalCost?.toFixed(2) || "0.00"}"`,
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kardex_${productName.replace(/\s+/g, "_")}_${startDate}_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Archivo CSV exportado correctamente");
  }, [movements, selectedProduct, startDate, endDate, currentUser, summary]);

  // ── Compute running totals for summary cards ───────────────────────────────
  const summaryCards = useMemo(() => {
    return {
      initialStock: summary?.initialBalance.qty ?? 0,
      totalEntries: summary?.totalEntries ?? 0,
      totalExits: summary?.totalExits ?? 0,
      finalStock: summary?.finalBalance.qty ?? 0,
      finalAvgCost: summary?.finalBalance.avgCost ?? 0,
      finalTotalCost: summary?.finalBalance.totalCost ?? 0,
    };
  }, [summary]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Kardex de Inventario
            </h2>
            <p className="text-sm text-slate-500">
              Control detallado de movimientos por producto
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters Card ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700">
            <Filter className="h-4 w-4" />
            Parámetros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Product Selector */}
            <div className="relative lg:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-600">
                Producto
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar producto por nombre..."
                  className="pl-9 pr-8"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setSelectedProductId("");
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => {
                    // Small delay to allow click on dropdown item
                    setTimeout(() => setShowProductDropdown(false), 200);
                  }}
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              {/* Dropdown */}
              {showProductDropdown && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredProducts.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-500">
                      No se encontraron productos
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        onClick={() => handleSelectProduct(product)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            {product.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            Costo: {currency} {product.cost.toFixed(2)} ·
                            Stock: {product.stock}
                          </div>
                        </div>
                        <Package className="h-4 w-4 flex-shrink-0 text-slate-400" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">
                Fecha Inicio
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">
                Fecha Fin
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={fetchKardex}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-900 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </>
              )}
            </Button>

            {movements.length > 0 && (
              <Button
                variant="outline"
                onClick={exportCSV}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Selected Product Info ─────────────────────────────────────────────── */}
      {selectedProduct && (
        <Card className="border-slate-200">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">
                  {selectedProduct.name}
                </span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Costo actual:</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {currency} {selectedProduct.cost.toFixed(2)}
                </Badge>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Stock actual:</span>
                <Badge
                  variant="outline"
                  className={`font-mono text-xs ${
                    selectedProduct.stock <= 0
                      ? "border-red-300 text-red-700 bg-red-50"
                      : "border-emerald-300 text-emerald-700 bg-emerald-50"
                  }`}
                >
                  {selectedProduct.stock}
                </Badge>
              </div>
              {currentUser && (
                <>
                  <div className="h-4 w-px bg-slate-200" />
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500">
                      {currentUser.fullName}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Loading State ────────────────────────────────────────────────────── */}
      {loading && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
              <p className="text-sm font-medium text-slate-600">
                Cargando movimientos del kardex...
              </p>
              <p className="text-xs text-slate-400">
                Consultando inventory movements
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty / No Search State ─────────────────────────────────────────── */}
      {!loading && !searched && (
        <Card className="border-dashed">
          <CardContent className="py-20">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <PackageSearch className="h-8 w-8 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-700">
                  Seleccione un producto y busque
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Elija un producto, defina el rango de fechas y haga clic en
                  &quot;Buscar&quot; para ver el kardex
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty Results State ───────────────────────────────────────────────── */}
      {!loading && searched && movements.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-20">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-700">
                  Sin movimientos encontrados
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {message ||
                    "No se encontraron movimientos para este producto en el rango de fechas seleccionado"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Kardex Data ─────────────────────────────────────────────────────── */}
      {!loading && movements.length > 0 && summary && (
        <>
          {/* ── Summary Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/* Stock Inicial */}
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <Package className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Stock Inicial
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {summaryCards.initialStock.toLocaleString("es-VE", {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-slate-400">unidades</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Entradas */}
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <ArrowUpCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-green-600">
                      Total Entradas
                    </p>
                    <p className="text-2xl font-bold text-green-700">
                      +{summaryCards.totalEntries.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-green-500">unidades</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Salidas */}
            <Card className="border-red-200 bg-red-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-100">
                    <ArrowDownCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                      Total Salidas
                    </p>
                    <p className="text-2xl font-bold text-red-700">
                      -{summaryCards.totalExits.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-red-500">unidades</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Final */}
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                      Stock Final
                    </p>
                    <p className="text-2xl font-bold text-blue-700">
                      {summaryCards.finalStock.toLocaleString("es-VE", {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-blue-500">
                      CP: {summaryCards.finalAvgCost.toFixed(2)} · CT:{" "}
                      {summaryCards.finalTotalCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Date range info ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-4 rounded-lg bg-slate-50 px-4 py-2.5">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-600">
              Período:{" "}
              <span className="font-semibold">
                {formatDate(startDate)} al {formatDate(endDate)}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-600">
              Total movimientos:{" "}
              <span className="font-semibold">{movements.length}</span>
            </span>
          </div>

          {/* ── Movements Table ─────────────────────────────────────────────── */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  {/* Table Header */}
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-800 text-white">
                      <th className="px-3 py-3 text-left font-semibold text-slate-200 w-10">
                        #
                      </th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-200">
                        Fecha/Hora
                      </th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-200">
                        Concepto
                      </th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-200">
                        Usuario
                      </th>
                      <th className="px-3 py-3 text-right font-semibold text-green-300">
                        Entrada
                      </th>
                      <th className="px-3 py-3 text-right font-semibold text-red-300">
                        Salida
                      </th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-200">
                        Saldo Qty
                      </th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-200">
                        Costo Prom.
                      </th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-200">
                        Costo Total
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody>
                    {movements.map((movement, index) => {
                      const isEntry = ENTRY_TYPES.has(movement.movementType);
                      const isExit = EXIT_TYPES.has(movement.movementType);
                      const isAlt = index % 2 === 1;

                      return (
                        <tr
                          key={movement.id}
                          className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                            isAlt ? "bg-slate-50/50" : "bg-white"
                          }`}
                        >
                          {/* # */}
                          <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">
                            {index + 1}
                          </td>

                          {/* Fecha/Hora */}
                          <td className="px-3 py-2.5">
                            <div className="text-slate-800 font-medium text-xs">
                              {formatDate(movement.date)}
                            </div>
                            <div className="text-slate-400 text-xs">
                              {formatTime(movement.date)}
                            </div>
                          </td>

                          {/* Concepto + Badge */}
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-700 text-xs">
                                {movement.concept ||
                                  MOVEMENT_TYPE_LABELS[movement.movementType] ||
                                  movement.movementType}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 w-fit ${
                                  MOVEMENT_TYPE_COLORS[movement.movementType] ||
                                  "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {MOVEMENT_TYPE_LABELS[movement.movementType] ||
                                  movement.movementType}
                              </Badge>
                            </div>
                          </td>

                          {/* Usuario */}
                          <td className="px-3 py-2.5 text-slate-600 text-xs">
                            {movement.userName || movement.userId || "—"}
                          </td>

                          {/* Entrada */}
                          <td className="px-3 py-2.5 text-right">
                            {isEntry ? (
                              <span className="font-semibold text-green-600 text-xs">
                                +{movement.absQuantity}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Salida */}
                          <td className="px-3 py-2.5 text-right">
                            {isExit ? (
                              <span className="font-semibold text-red-600 text-xs">
                                -{movement.absQuantity}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Saldo Qty */}
                          <td className="px-3 py-2.5 text-right">
                            <span
                              className={`font-mono font-semibold text-xs ${
                                movement.balanceQty <= 0
                                  ? "text-red-600"
                                  : "text-slate-800"
                              }`}
                            >
                              {movement.balanceQty}
                            </span>
                          </td>

                          {/* Costo Promedio */}
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-600">
                            {movement.balanceAvgCost.toFixed(2)}
                          </td>

                          {/* Costo Total */}
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-600">
                            {movement.balanceTotalCost.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Table Footer (Totals) */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100">
                      <td
                        colSpan={4}
                        className="px-3 py-3 text-right font-semibold text-slate-700 text-xs"
                      >
                        TOTALES
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-green-700 text-xs">
                        {summaryCards.totalEntries > 0
                          ? `+${summaryCards.totalEntries}`
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-red-700 text-xs">
                        {summaryCards.totalExits > 0
                          ? `-${summaryCards.totalExits}`
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {summaryCards.finalStock}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {summaryCards.finalAvgCost.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {summaryCards.finalTotalCost.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
