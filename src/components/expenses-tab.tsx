"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Receipt, Plus, Trash2, Search, Edit2, TrendingUp, TrendingDown,
  DollarSign, Calendar, Filter, PieChart, BarChart3, Wallet,
  ChevronDown, ChevronUp, X, Save, Tag
} from "lucide-react";

interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  active: boolean;
  _count?: { expenses: number };
}

interface Expense {
  id: string;
  categoryId: string;
  description: string;
  amount: number;
  amountBs: number;
  exchangeRate: number;
  date: string;
  paymentMethod: string;
  reference: string;
  notes: string;
  userId: string | null;
  category: { id: string; name: string; icon: string; color: string };
  user: { id: string; fullName: string; username: string; role: string } | null;
  createdAt: string;
}

interface ProfitLossReport {
  period: { startDate: string; endDate: string };
  exchangeRate: number;
  ventas: {
    totalUsd: number; totalBs: number; count: number;
    devolucionesUsd: number; netasUsd: number; netasBs: number;
    porMetodo: Record<string, number>;
  };
  costoVentas: { totalUsd: number; totalBs: number };
  compras: { totalUsd: number; totalBs: number };
  gastos: {
    totalUsd: number; totalBs: number; count: number;
    porCategoria: { name: string; icon: string; color: string; totalUsd: number; totalBs: number; count: number }[];
    porMetodo: Record<string, number>;
  };
  utilidad: {
    brutaUsd: number; brutaBs: number; netaUsd: number; netaBs: number;
    margenBrutoPct: number; margenNetoPct: number; esPerdida: boolean;
  };
}

const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "zelle", label: "Zelle" },
  { value: "usdt", label: "USDT" },
  { value: "punto", label: "Punto de Venta" },
  { value: "otro", label: "Otro" },
];

const DEFAULT_CATEGORIES = [
  { name: "Servicios", icon: "zap", color: "#3b82f6", description: "Luz, internet, agua, telefono" },
  { name: "Alquiler", icon: "home", color: "#8b5cf6", description: "Renta del local, mantenimiento" },
  { name: "Nomina", icon: "users", color: "#10b981", description: "Salarios, bonificaciones" },
  { name: "Transporte", icon: "truck", color: "#f59e0b", description: "Gasolina, envios, fletes" },
  { name: "Empaque", icon: "package", color: "#06b6d4", description: "Bolsas, cajas, etiquetas" },
  { name: "Tecnologia", icon: "monitor", color: "#6366f1", description: "Software, hosting, dominio" },
  { name: "Impuestos", icon: "landmark", color: "#ec4899", description: "Impuestos municipales, contabilidad" },
  { name: "Publicidad", icon: "megaphone", color: "#14b8a6", description: "Marketing, promociones" },
  { name: "Otros", icon: "ellipsis", color: "#64748b", description: "Gastos diversos" },
];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getFirstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("es-VE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function getPaymentLabel(method: string) {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
}

export default function ExpensesTab({ bcvRate = 36.5, currency = "USD", sellerName = "", sellerRole = "", userId = "" }: {
  bcvRate?: number;
  currency?: string;
  sellerName?: string;
  sellerRole?: string;
  userId?: string;
}) {
  // State
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"registro" | "reporte">("registro");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoryId: "",
    description: "",
    amount: "",
    date: getToday(),
    paymentMethod: "efectivo",
    reference: "",
    notes: "",
  });

  // Filters
  const [filterStartDate, setFilterStartDate] = useState(getFirstOfMonth());
  const [filterEndDate, setFilterEndDate] = useState(getToday());
  const [filterCategory, setFilterCategory] = useState("");

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", description: "", icon: "receipt", color: "#ef4444" });

  // Profit/Loss
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStart, setReportStart] = useState(getFirstOfMonth());
  const [reportEnd, setReportEnd] = useState(getToday());

  // Expanded expense rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadCategories();
    loadExpenses();
  }, []);

  async function loadCategories() {
    try {
      const res = await fetch("/api/expense-categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        if (data.length === 0) seedDefaultCategories();
      }
    } catch {
      toast.error("Error al cargar categorías");
    }
  }

  async function loadExpenses() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);
      if (filterCategory) params.set("categoryId", filterCategory);

      const res = await fetch(`/api/expenses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch {
      toast.error("Error al cargar gastos");
    } finally {
      setLoading(false);
    }
  }

  async function seedDefaultCategories() {
    try {
      await Promise.all(
        DEFAULT_CATEGORIES.map((cat) =>
          fetch("/api/expense-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cat),
          })
        )
      );
      const res = await fetch("/api/expense-categories");
      if (res.ok) setCategories(await res.json());
      toast.success("Categorías por defecto creadas");
    } catch {
      toast.error("Error al crear categorías por defecto");
    }
  }

  // Save expense
  async function saveExpense() {
    if (!form.categoryId) return toast.error("Seleccione una categoría");
    if (!form.description.trim()) return toast.error("Ingrese una descripción");
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error("Monto inválido");
    if (!form.date) return toast.error("Seleccione una fecha");

    try {
      const body = {
        ...form,
        amount: parseFloat(form.amount),
        exchangeRate: bcvRate,
        userId: userId || null,
      };

      const url = editingId ? `/api/expenses?id=${editingId}` : "/api/expenses";
      const method = editingId ? "PUT" : "POST";
      // Para PUT pasamos id en body
      const payload = editingId ? { ...body, id: editingId } : body;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingId ? "Gasto actualizado" : "Gasto registrado");
        resetForm();
        setShowForm(false);
        loadExpenses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Gasto eliminado");
        loadExpenses();
      } else toast.error("Error al eliminar");
    } catch {
      toast.error("Error de conexión");
    }
  }

  function resetForm() {
    setForm({
      categoryId: "",
      description: "",
      amount: "",
      date: getToday(),
      paymentMethod: "efectivo",
      reference: "",
      notes: "",
    });
    setEditingId(null);
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setForm({
      categoryId: exp.categoryId,
      description: exp.description,
      amount: String(exp.amount),
      date: exp.date.split("T")[0],
      paymentMethod: exp.paymentMethod,
      reference: exp.reference,
      notes: exp.notes,
    });
    setShowForm(true);
  }

  // Save category
  async function saveCategory() {
    if (!catForm.name.trim()) return toast.error("Nombre requerido");
    try {
      const res = await fetch("/api/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catForm),
      });
      if (res.ok) {
        toast.success("Categoría creada");
        setCatForm({ name: "", description: "", icon: "receipt", color: "#ef4444" });
        setShowCatForm(false);
        loadCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear categoría");
      }
    } catch {
      toast.error("Error de conexión");
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      const res = await fetch(`/api/expense-categories?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Categoría eliminada");
        loadCategories();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  }

  // Load Profit/Loss report
  async function loadReport() {
    try {
      setReportLoading(true);
      const res = await fetch(`/api/reports/profit-loss?startDate=${reportStart}&endDate=${reportEnd}`);
      if (res.ok) {
        setReport(await res.json());
      } else {
        toast.error("Error al generar reporte");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setReportLoading(false);
    }
  }

  // Totals del filtro actual
  const filteredTotalUsd = expenses.reduce((s, e) => s + e.amount, 0);
  const filteredTotalBs = expenses.reduce((s, e) => s + e.amountBs, 0);

  return (
    <div className="space-y-4">
      {/* Sub-tabs header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeSubTab === "registro" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("registro")}
        >
          <Receipt className="h-4 w-4 mr-1" /> Registro de Gastos
        </Button>
        <Button
          variant={activeSubTab === "reporte" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("reporte")}
        >
          <BarChart3 className="h-4 w-4 mr-1" /> Utilidad / Pérdida
        </Button>
        <div className="flex-1" />
        {activeSubTab === "registro" && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo Gasto
          </Button>
        )}
      </div>

      {/* =================== REGISTRO DE GASTOS =================== */}
      {activeSubTab === "registro" && (
        <>
          {/* Resumen cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Receipt className="h-3 w-3" /> Total Gastos
                </p>
                <p className="text-lg font-bold text-red-600">
                  ${fmt(filteredTotalUsd)}
                </p>
                <p className="text-xs text-muted-foreground">Bs. {fmt(filteredTotalBs)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Categorías
                </p>
                <p className="text-lg font-bold">{categories.length}</p>
                <p className="text-xs text-muted-foreground">Activas</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Registros
                </p>
                <p className="text-lg font-bold">{expenses.length}</p>
                <p className="text-xs text-muted-foreground">En periodo</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Tasa BCV
                </p>
                <p className="text-lg font-bold">{fmt(bcvRate)}</p>
                <p className="text-xs text-muted-foreground">Bs/USD</p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Desde:</Label>
                <Input
                  type="date"
                  className="w-36 h-8 text-xs"
                  value={filterStartDate}
                  onChange={(e) => { setFilterStartDate(e.target.value); }}
                />
                <Label className="text-xs text-muted-foreground">Hasta:</Label>
                <Input
                  type="date"
                  className="w-36 h-8 text-xs"
                  value={filterEndDate}
                  onChange={(e) => { setFilterEndDate(e.target.value); }}
                />
                <Label className="text-xs text-muted-foreground">Categoría:</Label>
                <select
                  className="border rounded h-8 px-2 text-xs bg-background"
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); }}
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" onClick={loadExpenses}>
                  <Search className="h-3 w-3 mr-1" /> Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de gastos */}
          <Card>
            <CardHeader className="p-3 pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Gastos Registrados</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowCatForm(true)}>
                <Tag className="h-3 w-3 mr-1" /> Gestionar Categorías
              </Button>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {loading ? (
                <p className="text-center text-sm text-muted-foreground py-8">Cargando...</p>
              ) : expenses.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No hay gastos registrados en este periodo.
                  <br />
                  <Button size="sm" variant="link" onClick={() => { resetForm(); setShowForm(true); }}>
                    Registrar primer gasto
                  </Button>
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-2">Fecha</th>
                        <th className="pb-2 pr-2">Categoría</th>
                        <th className="pb-2 pr-2">Descripción</th>
                        <th className="pb-2 pr-2 text-right">Monto $</th>
                        <th className="pb-2 pr-2 text-right">Monto Bs</th>
                        <th className="pb-2 pr-2">Método</th>
                        <th className="pb-2 pr-2">Registró</th>
                        <th className="pb-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 pr-2 whitespace-nowrap">
                            {new Date(exp.date).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </td>
                          <td className="py-2 pr-2">
                            <Badge
                              variant="outline"
                              style={{ borderColor: exp.category.color, color: exp.category.color }}
                              className="text-xs"
                            >
                              {exp.category.name}
                            </Badge>
                          </td>
                          <td className="py-2 pr-2 max-w-[200px] truncate">{exp.description}</td>
                          <td className="py-2 pr-2 text-right font-medium text-red-600">
                            ${fmt(exp.amount)}
                          </td>
                          <td className="py-2 pr-2 text-right text-muted-foreground">
                            {fmt(exp.amountBs)}
                          </td>
                          <td className="py-2 pr-2 whitespace-nowrap">{getPaymentLabel(exp.paymentMethod)}</td>
                          <td className="py-2 pr-2 text-muted-foreground">
                            {exp.user ? (exp.user.fullName || exp.user.username) : "—"}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEdit(exp)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => deleteExpense(exp.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total footer */}
              {expenses.length > 0 && (
                <div className="flex justify-between items-center mt-3 pt-3 border-t text-sm font-bold">
                  <span>Total ({expenses.length} gastos)</span>
                  <div className="flex gap-4">
                    <span className="text-red-600">${fmt(filteredTotalUsd)}</span>
                    <span className="text-muted-foreground">Bs. {fmt(filteredTotalBs)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* =================== REPORTE UTILIDAD / PÉRDIDA =================== */}
      {activeSubTab === "reporte" && (
        <>
          {/* Filtros de periodo */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Desde:</Label>
                <Input
                  type="date"
                  className="w-36 h-8 text-xs"
                  value={reportStart}
                  onChange={(e) => setReportStart(e.target.value)}
                />
                <Label className="text-xs text-muted-foreground">Hasta:</Label>
                <Input
                  type="date"
                  className="w-36 h-8 text-xs"
                  value={reportEnd}
                  onChange={(e) => setReportEnd(e.target.value)}
                />
                <Button size="sm" onClick={loadReport} disabled={reportLoading}>
                  <BarChart3 className="h-3 w-3 mr-1" />
                  {reportLoading ? "Generando..." : "Generar Reporte"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setReportStart(getFirstOfMonth());
                  setReportEnd(getToday());
                }}>
                  Este Mes
                </Button>
              </div>
            </CardContent>
          </Card>

          {report ? (
            <div className="space-y-4">
              {/* Cards principales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Ventas Netas
                    </p>
                    <p className="text-lg font-bold text-green-600">
                      ${fmt(report.ventas.netasUsd)}
                    </p>
                    <p className="text-xs text-muted-foreground">Bs. {fmt(report.ventas.netasBs)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{report.ventas.count} ventas</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <PieChart className="h-3 w-3" /> Costo de Ventas
                    </p>
                    <p className="text-lg font-bold text-orange-600">
                      ${fmt(report.costoVentas.totalUsd)}
                    </p>
                    <p className="text-xs text-muted-foreground">Bs. {fmt(report.costoVentas.totalBs)}</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Receipt className="h-3 w-3" /> Total Gastos
                    </p>
                    <p className="text-lg font-bold text-red-600">
                      ${fmt(report.gastos.totalUsd)}
                    </p>
                    <p className="text-xs text-muted-foreground">Bs. {fmt(report.gastos.totalBs)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{report.gastos.count} gastos</p>
                  </CardContent>
                </Card>

                <Card className={`border-l-4 ${report.utilidad.esPerdida ? "border-l-red-700" : "border-l-emerald-500"}`}>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {report.utilidad.esPerdida ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      Utilidad Neta
                    </p>
                    <p className={`text-lg font-bold ${report.utilidad.esPerdida ? "text-red-700" : "text-emerald-600"}`}>
                      ${fmt(report.utilidad.netaUsd)}
                    </p>
                    <p className="text-xs text-muted-foreground">Bs. {fmt(report.utilidad.netaBs)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Margen: {fmt(report.utilidad.margenNetoPct)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detalle de Utilidad */}
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm font-medium">Estado de Resultados</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-green-600 font-medium">+ Ventas Brutas</span>
                      <span className="text-green-600 font-medium">${fmt(report.ventas.totalUsd)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 pl-4">
                      <span className="text-red-500">- Devoluciones</span>
                      <span className="text-red-500">-${fmt(report.ventas.devolucionesUsd)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center py-1">
                      <span className="font-bold">= Ventas Netas</span>
                      <span className="font-bold text-green-600">${fmt(report.ventas.netasUsd)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 pl-4">
                      <span className="text-orange-600">- Costo de Ventas</span>
                      <span className="text-orange-600">-${fmt(report.costoVentas.totalUsd)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center py-1 bg-muted/30 px-2 rounded">
                      <span className="font-bold">= Utilidad Bruta</span>
                      <span className="font-bold">${fmt(report.utilidad.brutaUsd)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 pl-4">
                      <span className="text-muted-foreground text-xs">Margen Bruto</span>
                      <span className="text-muted-foreground text-xs">{fmt(report.utilidad.margenBrutoPct)}%</span>
                    </div>
                    <div className="flex justify-between items-center py-1 pl-4">
                      <span className="text-red-500">- Gastos Operativos</span>
                      <span className="text-red-500">-${fmt(report.gastos.totalUsd)}</span>
                    </div>
                    <Separator />
                    <div className={`flex justify-between items-center py-2 px-2 rounded font-bold text-base ${
                      report.utilidad.esPerdida
                        ? "bg-red-100 dark:bg-red-950 text-red-700"
                        : "bg-green-100 dark:bg-green-950 text-green-700"
                    }`}>
                      <span>
                        {report.utilidad.esPerdida ? "PERDIDA NETA" : "UTILIDAD NETA"}
                      </span>
                      <span>${fmt(report.utilidad.netaUsd)}</span>
                    </div>
                    <div className={`flex justify-between items-center px-2 text-xs ${
                      report.utilidad.esPerdida ? "text-red-600" : "text-green-600"
                    }`}>
                      <span>Margen Neto</span>
                      <span className="font-medium">{fmt(report.utilidad.margenNetoPct)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Desglose de gastos por categoría */}
              {report.gastos.porCategoria.length > 0 && (
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1">
                      <PieChart className="h-4 w-4" /> Gastos por Categoría
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="space-y-2">
                      {report.gastos.porCategoria
                        .sort((a, b) => b.totalUsd - a.totalUsd)
                        .map((cat, idx) => {
                          const pct = report.gastos.totalUsd > 0 ? (cat.totalUsd / report.gastos.totalUsd) * 100 : 0;
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <Badge variant="outline" style={{ borderColor: cat.color, color: cat.color }} className="text-xs min-w-[80px] justify-center">
                                {cat.name}
                              </Badge>
                              <div className="flex-1">
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(pct, 100)}%`,
                                      backgroundColor: cat.color,
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="text-xs font-medium min-w-[80px] text-right">
                                ${fmt(cat.totalUsd)}
                              </span>
                              <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                                {fmt(pct)}%
                              </span>
                              <span className="text-xs text-muted-foreground min-w-[30px] text-right">
                                ({cat.count})
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Compras del periodo (info adicional) */}
              {report.compras.totalUsd > 0 && (
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1">
                      <Wallet className="h-4 w-4" /> Compras de Inventario (periodo)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="flex justify-between text-sm">
                      <span>Total Compras</span>
                      <span className="font-medium">${fmt(report.compras.totalUsd)} / Bs. {fmt(report.compras.totalBs)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Nota: Las compras de inventario se reflejan en el Costo de Ventas al momento de vender los productos, no al comprarlos.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Seleccione un periodo y haga clic en &quot;Generar Reporte&quot; para ver el Estado de Resultados.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* =================== MODAL: FORMULARIO GASTO =================== */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingId ? "Editar Gasto" : "Registrar Gasto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Categoría *</Label>
              <select
                className="w-full border rounded h-9 px-3 text-sm bg-background"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Seleccione...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs">Descripción / Concepto *</Label>
              <Input
                placeholder="Ej: Pago de servicio de internet"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Monto (USD) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Monto (Bs) - auto</Label>
                <Input
                  type="text"
                  disabled
                  value={
                    form.amount && parseFloat(form.amount) > 0
                      ? fmt(parseFloat(form.amount) * bcvRate)
                      : "0.00"
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fecha *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Método de Pago</Label>
                <select
                  className="w-full border rounded h-9 px-3 text-sm bg-background"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Referencia / Nro Comprobante</Label>
              <Input
                placeholder="Opcional"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs">Notas</Label>
              <textarea
                className="w-full border rounded p-2 text-sm bg-background min-h-[60px] resize-none"
                placeholder="Notas adicionales (opcional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveExpense}>
                <Save className="h-4 w-4 mr-1" />
                {editingId ? "Actualizar" : "Registrar Gasto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* =================== MODAL: GESTIONAR CATEGORÍAS =================== */}
      <Dialog open={showCatForm} onOpenChange={setShowCatForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Categorías de Gastos</DialogTitle>
          </DialogHeader>

          {/* Listado */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="flex-1 font-medium">{cat.name}</span>
                <span className="text-xs text-muted-foreground">{cat.description}</span>
                <span className="text-xs text-muted-foreground">({cat._count?.expenses || 0})</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-red-500"
                  onClick={() => deleteCategory(cat.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">No hay categorías</p>
            )}
          </div>

          <Separator />

          {/* Crear nueva */}
          <div className="space-y-2">
            <p className="text-xs font-medium">Nueva Categoría</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nombre *"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              />
              <Input
                placeholder="Descripción"
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Icono</Label>
                <Input
                  placeholder="receipt"
                  value={catForm.icon}
                  onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-10 h-8 p-0 cursor-pointer"
                    value={catForm.color}
                    onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                  />
                  <Input
                    placeholder="#ef4444"
                    value={catForm.color}
                    onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <Button size="sm" onClick={saveCategory} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Crear Categoría
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
