"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, HandCoins } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

// Safe number: converts null/undefined/NaN to 0
function sn(v: any): number {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

interface CreditClient {
  id: string;
  fullName: string;
  docType: string;
  docNumber: string;
  creditBalance: number;
  creditLimit?: number;
  creditSalesCount: number;
  totalOwedUsd: number;
  totalOwedBs: number;
  sales: { id: string; date: string; total: number; paid: number; remaining: number; creditDays?: number; creditDueDate?: string }[];
}

interface CreditSale {
  id: string;
  date: string;
  total: number;
  totalBs: number;
  creditPaid: number;
  creditDays?: number;
  creditDueDate?: string;
  exchangeRate: number;
  client?: { id: string; fullName: string; docType: string; docNumber: string; creditBalance: number; };
  items?: any[];
  creditPayments?: CreditPayment[];
}

interface CreditPayment {
  id: string;
  date: string;
  amount: number;
  amountBs: number;
  method: string;
  reference: string;
  notes: string;
  createdBy: string;
}

interface CreditTabProps {
  bcvRate: number;
  currency: string;
  sellerName: string;
}

export default function CreditTab({ bcvRate, currency, sellerName }: CreditTabProps) {
  const [clients, setClients] = useState<CreditClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedClient, setSelectedClient] = useState<CreditClient | null>(null);
  const [clientSales, setClientSales] = useState<CreditSale[]>([]);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [salePayments, setSalePayments] = useState<CreditPayment[]>([]);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payingSale, setPayingSale] = useState<CreditSale | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "efectivo", reference: "", notes: "" });

  // Payment methods (same as POS)
  const PAY_METHODS: { value: string; label: string }[] = [
    { value: "efectivo", label: "Efectivo (Bs)" },
    { value: "efectivo-usd", label: "Efectivo ($)" },
    { value: "transferencia", label: "Transferencia" },
    { value: "pago-movil", label: "Pago Movil" },
    { value: "punto-de-venta", label: "Punto de Venta" },
    { value: "zelle", label: "Zelle ($)" },
    { value: "usdt", label: "USDT ($)" },
  ];

  const METHOD_LABELS: Record<string, string> = {
    efectivo: "Efectivo (Bs)",
    'efectivo-usd': "Efectivo ($)",
    transferencia: "Transferencia",
    "pago-movil": "Pago Movil",
    "punto-de-venta": "Punto de Venta",
    zelle: "Zelle ($)",
    usdt: "USDT ($)",
    // Legacy keys from older abonos
    mobile: "Pago Movil",
    punto: "Punto de Venta",
  };

  const showPayRefField = ["transferencia", "pago-movil", "zelle", "usdt"].includes(payForm.method);
  const [saving, setSaving] = useState(false);

  // Search
  const [creditSearch, setCreditSearch] = useState("");
  const filteredClients = clients.filter(c =>
    (c.fullName || "").toLowerCase().includes(creditSearch.toLowerCase()) ||
    (c.docNumber || "").includes(creditSearch)
  );

  const loadClients = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await authFetch("/api/credit");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || `Error al cargar cuentas por cobrar (${res.status})`;
        setErrorMsg(msg);
        toast.error(msg);
        setClients([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setErrorMsg("Formato de datos inesperado");
        setClients([]);
        return;
      }
      // Sanitize all numeric fields from potential null/undefined
      const sanitized = data.map((c: any) => ({
        id: c.id || "",
        fullName: c.fullName || "",
        docType: c.docType || "",
        docNumber: c.docNumber || "",
        creditBalance: sn(c.creditBalance),
        creditLimit: sn(c.creditLimit),
        creditSalesCount: sn(c.creditSalesCount),
        totalOwedUsd: sn(c.totalOwedUsd),
        totalOwedBs: sn(c.totalOwedBs),
        sales: Array.isArray(c.sales) ? c.sales.map((s: any) => ({
          id: s.id || "",
          date: s.date || new Date().toISOString(),
          total: sn(s.total),
          paid: sn(s.paid ?? s.creditPaid),
          remaining: sn(s.remaining ?? (sn(s.total) - sn(s.paid ?? s.creditPaid))),
          creditDays: s.creditDays,
          creditDueDate: s.creditDueDate,
        })) : [],
      }));
      setClients(sanitized);
    } catch (err: any) {
      console.error("Credit load error:", err);
      const msg = "Error de conexion al cargar cuentas por cobrar";
      setErrorMsg(msg);
      toast.error(msg);
      setClients([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadClients(); }, []);

  const selectClient = async (client: CreditClient) => {
    setSelectedClient(selectedClient?.id === client.id ? null : client);
    if (selectedClient?.id !== client.id) {
      try {
        const res = await authFetch(`/api/credit?clientId=${client.id}`);
        if (!res.ok) {
          console.error("Credit API error:", res.status, res.statusText);
          toast.error(`Error al cargar ventas a credito (${res.status})`);
          setClientSales([]);
          return;
        }
        const data = await res.json();
        if (!Array.isArray(data)) { setClientSales([]); return; }
        // Sanitize sale data
        const sanitized = data.map((s: any) => ({
          id: s.id || "",
          date: s.date || new Date().toISOString(),
          total: sn(s.total),
          totalBs: sn(s.totalBs),
          creditPaid: sn(s.creditPaid),
          creditDays: s.creditDays,
          creditDueDate: s.creditDueDate,
          exchangeRate: sn(s.exchangeRate),
          client: s.client ? {
            id: s.client.id || "",
            fullName: s.client.fullName || "",
            docType: s.client.docType || "",
            docNumber: s.client.docNumber || "",
            creditBalance: sn(s.client.creditBalance),
          } : undefined,
          items: s.items,
          creditPayments: Array.isArray(s.creditPayments) ? s.creditPayments.map((p: any) => ({
            id: p.id || "",
            date: p.date || new Date().toISOString(),
            amount: sn(p.amount),
            amountBs: sn(p.amountBs),
            method: p.method || "",
            reference: p.reference || "",
            notes: p.notes || "",
            createdBy: p.createdBy || "",
          })) : [],
        }));
        setClientSales(sanitized);
      } catch (err: any) { console.error("Credit fetch error:", err); toast.error("Error al cargar ventas a credito"); }
    }
  };

  const selectSale = async (saleId: string) => {
    if (expandedSale === saleId) {
      setExpandedSale(null);
      setSalePayments([]);
      return;
    }
    setExpandedSale(saleId);
    try {
      const res = await authFetch(`/api/credit?saleId=${saleId}`);
      if (!res.ok) { setSalePayments([]); return; }
      const data = await res.json();
      const payments = Array.isArray(data?.creditPayments) ? data.creditPayments : [];
      const sanitized = payments.map((p: any) => ({
        id: p.id || "",
        date: p.date || new Date().toISOString(),
        amount: sn(p.amount),
        amountBs: sn(p.amountBs),
        method: p.method || "",
        reference: p.reference || "",
        notes: p.notes || "",
        createdBy: p.createdBy || "",
      }));
      setSalePayments(sanitized);
    } catch { setSalePayments([]); }
  };

  const openPayDialog = (sale: CreditSale) => {
    setPayingSale(sale);
    setPayForm({ amount: "", method: "efectivo", reference: "", notes: "" });
    setShowPayDialog(true);
  };

  const handlePayMethodChange = (method: string) => {
    setPayForm({ ...payForm, method, reference: (method === "transferencia" || method === "pago-movil") ? payForm.reference : "" });
  };

  const registerPayment = async () => {
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { toast.error("Ingrese un monto valido"); return; }
    if (!payingSale) return;
    // Validate reference for transferencia and pago-movil
    if (["transferencia", "pago-movil"].includes(payForm.method) && !payForm.reference.trim()) {
      toast.error("Debe ingresar el numero de referencia para " + (payForm.method === "transferencia" ? "Transferencia" : "Pago Movil"));
      return;
    }

    const remaining = sn(payingSale.total) - sn(payingSale.creditPaid);
    if (amount > remaining) {
      toast.error(`El monto excede el saldo pendiente ($${remaining.toFixed(2)})`);
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch("/api/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: payingSale.id,
          clientId: payingSale.client?.id,
          amount,
          method: payForm.method,
          reference: payForm.reference,
          notes: payForm.notes,
          createdBy: sellerName,
          exchangeRate: bcvRate,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errData.error || "Error al registrar abono");
      }

      toast.success(`Abono registrado: $${amount.toFixed(2)}`);
      setShowPayDialog(false);
      await loadClients();
      if (selectedClient) {
        const res2 = await authFetch(`/api/credit?clientId=${selectedClient.id}`);
        const data2 = await res2.json();
        setClientSales(Array.isArray(data2) ? data2 : []);
      }
      if (expandedSale) {
        try {
          const res3 = await authFetch(`/api/credit?payments=true&saleId=${expandedSale}`);
          const data3 = await res3.json();
          setSalePayments(Array.isArray(data3) ? data3 : []);
        } catch { setSalePayments([]); }
      }
    } catch (e: any) { toast.error(e.message || "Error al registrar abono"); }
    finally { setSaving(false); }
  };

  const totalDebtUsd = clients.reduce((sum, c) => sum + sn(c.totalOwedUsd), 0);
  const totalDebtBs = clients.reduce((sum, c) => sum + sn(c.totalOwedBs), 0);

  // Show error state
  if (errorMsg && !loading && clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
        <p className="text-sm">{errorMsg}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={loadClients}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border-red-200 bg-red-50/50">
          <p className="text-xl font-bold text-red-600">${totalDebtUsd.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Deuda Total USD</p>
        </Card>
        <Card className="p-3 border-orange-200 bg-orange-50/50">
          <p className="text-xl font-bold text-orange-600">Bs. {totalDebtBs.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Deuda Total Bs</p>
        </Card>
        <Card className="p-3">
          <p className="text-xl font-bold">{clients.length}</p>
          <p className="text-xs text-muted-foreground">Clientes con Deuda</p>
        </Card>
        <Card className="p-3">
          <p className="text-xl font-bold">{clients.reduce((sum, c) => sum + sn(c.creditSalesCount), 0)}</p>
          <p className="text-xs text-muted-foreground">Ventas a Credito</p>
        </Card>
      </div>

      {/* Search */}
      {clients.length > 3 && (
        <Input placeholder="Buscar cliente por nombre o documento..." value={creditSearch}
          onChange={(e) => setCreditSearch(e.target.value)} className="max-w-sm" />
      )}

      {/* Alert */}
      {clients.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <span className="text-yellow-800">{clients.length} cliente(s) con deuda pendiente por un total de <strong>${totalDebtUsd.toFixed(2)}</strong></span>
        </div>
      )}

      {/* Client list */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredClients.map((client) => {
              const initial = (client.fullName || "?").split(" ").map((n: string) => n[0] || "").join("").substring(0, 2).toUpperCase();
              const creditLimit = sn(client.creditLimit);
              return (
              <div key={client.id}>
                <button onClick={() => selectClient(client)} className="w-full text-left p-3 hover:bg-muted/30 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                      {initial}
                    </div>
                    <div>
                      <p className="font-medium">{client.fullName}</p>
                      <p className="text-xs text-muted-foreground">{client.docType}-{client.docNumber} | {client.creditSalesCount} venta(s) a credito</p>
                      {creditLimit > 0 && (
                        <p className="text-[10px] text-amber-600">Limite de credito: ${creditLimit.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-red-600">${client.totalOwedUsd.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Bs. {client.totalOwedBs.toFixed(2)}</p>
                    </div>
                    {selectedClient?.id === client.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded: Client sales */}
                {selectedClient?.id === client.id && (
                  <div className="bg-muted/20 p-3 space-y-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ventas a Credito de {client.fullName}</p>
                    {clientSales.map((sale) => {
                      const saleTotal = sn(sale.total);
                      const salePaid = sn(sale.creditPaid);
                      const remaining = saleTotal - salePaid;
                      const isExpanded = expandedSale === sale.id;
                      const isPaid = remaining <= 0.01;
                      return (
                        <div key={sale.id} className="border rounded-lg">
                          <div onClick={() => selectSale(sale.id)} className="w-full text-left p-2 hover:bg-muted/30 flex items-center justify-between cursor-pointer select-none">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              <div>
                                <p className="text-xs text-muted-foreground">{sale.date ? new Date(sale.date).toLocaleDateString("es-VE") : "Sin fecha"}
                                {sale.creditDueDate && (
                                  <span className={new Date(sale.creditDueDate) < new Date() && remaining > 0.01 ? "text-red-500 font-bold" : "text-muted-foreground"}>
                                    {" "}Vence: {new Date(sale.creditDueDate).toLocaleDateString("es-VE")}
                                  </span>
                                )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span>Total: <strong>${saleTotal.toFixed(2)}</strong></span>
                              <span className={isPaid ? "text-green-600" : "text-red-600"}>
                                {isPaid ? "Pagado" : `Pendiente: $${remaining.toFixed(2)}`}
                              </span>
                              {!isPaid && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); openPayDialog(sale); }}>
                                  <HandCoins className="h-3 w-3 mr-1" />Abonar
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Expanded: Payment history */}
                          {isExpanded && (
                            <div className="border-t p-2 space-y-1">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase">Historial de Abonos ({salePayments.length})</p>
                              {salePayments.length === 0 ? (
                                <p className="text-xs text-muted-foreground p-1">Sin abonos registrados</p>
                              ) : salePayments.map((pay) => (
                                <div key={pay.id} className="flex items-center justify-between text-xs p-1 bg-green-50 rounded">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                    <span>{pay.date ? new Date(pay.date).toLocaleDateString("es-VE") : ""}</span>
                                    <Badge variant="secondary" className="text-[8px]">{METHOD_LABELS[pay.method] || pay.method || ""}</Badge>
                                    {pay.reference && <span className="text-muted-foreground">Ref: {pay.reference}</span>}
                                  </div>
                                  <span className="font-bold text-green-600">${sn(pay.amount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {clientSales.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No tiene ventas a credito</p>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
          {clients.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? "Cargando..." : <><DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />No hay cuentas por cobrar pendientes</>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-green-600" /> Registrar Abono</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {payingSale && (() => {
              const payTotal = sn(payingSale.total);
              const payPaid = sn(payingSale.creditPaid);
              const payRemaining = payTotal - payPaid;
              return (
                <div className="p-2 bg-muted rounded text-xs">
                  <p>Deuda restante: <strong className="text-red-600">${payRemaining.toFixed(2)}</strong></p>
                  <p>Total venta: ${payTotal.toFixed(2)} | Pagado: ${payPaid.toFixed(2)}</p>
                </div>
              );
            })()}
            <div>
              <Label>Monto del Abono (USD) *</Label>
              <Input type="number" step="0.01" min="0" value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                placeholder="0.00" className="text-lg font-bold text-center h-14" />
              <p className="text-xs text-muted-foreground mt-1">Equivalente: Bs. {(parseFloat(payForm.amount || "0") * bcvRate).toFixed(2)}</p>
            </div>
            <div>
              <Label>Metodo de Pago</Label>
              <select value={payForm.method} onChange={(e) => handlePayMethodChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {PAY_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            {showPayRefField && (
              <div>
                <Label>Numero de Referencia *</Label>
                <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Ej: 12345678901234567890" className="font-mono" />
                <p className="text-[10px] text-muted-foreground">Ingrese el numero de referencia de la transaccion</p>
              </div>
            )}
            <div>
              <Label>Notas</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Observaciones" />
            </div>
            {payingSale && (() => {
              const payTotal = sn(payingSale.total);
              const payPaid = sn(payingSale.creditPaid);
              const payRemaining = payTotal - payPaid;
              return (
                <Button variant="outline" size="sm" className="mb-2 w-full" onClick={() => setPayForm({ ...payForm, amount: payRemaining.toFixed(2) })}>
                  Pagar Todo (${currency} {payRemaining.toFixed(2)})
                </Button>
              );
            })()}
            <Button className="w-full" onClick={registerPayment} disabled={saving || !payForm.amount}>
              {saving ? "Registrando..." : `Registrar Abono — $${parseFloat(payForm.amount || "0").toFixed(2)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
