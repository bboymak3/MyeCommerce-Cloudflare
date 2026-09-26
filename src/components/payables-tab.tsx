"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

interface PayableSupplier {
  supplierId: string;
  supplierName: string;
  rif: string;
  phone: string;
  totalOwedUsd: number;
  totalOwedBs: number;
  purchaseCount: number;
  oldestDueDate: string | null;
  overdue: boolean;
}

interface SupplierPayment { id: string; date: string; amount: number; amountBs: number; method: string; reference: string; notes: string; }
interface CreditPurchase {
  id: string; date: string; number: string; totalUsd: number; totalBs: number;
  paidAmount: number; dueDate: string | null; exchangeRate: number;
  payments?: SupplierPayment[];
}

const PAY_METHODS = [
  { value: "efectivo", label: "Efectivo (Bs)" },
  { value: "efectivo-usd", label: "Efectivo ($)" },
  { value: "transferencia", label: "Transferencia" },
  { value: "pago-movil", label: "Pago Movil" },
  { value: "zelle", label: "Zelle ($)" },
  { value: "usdt", label: "USDT ($)" },
];

export default function PayablesTab({ bcvRate, currency }: { bcvRate: number; currency: string }) {
  const [suppliers, setSuppliers] = useState<PayableSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayableSupplier | null>(null);
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [payingPurchase, setPayingPurchase] = useState<CreditPurchase | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "efectivo", reference: "", notes: "" });

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/supplier-payments");
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch { setSuppliers([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openSupplier = async (s: PayableSupplier) => {
    setSelected(s);
    try {
      const res = await authFetch(`/api/supplier-payments?supplierId=${s.supplierId}`);
      const data = await res.json();
      setPurchases(Array.isArray(data) ? data.filter((p: CreditPurchase) => p.totalUsd - p.paidAmount > 0.01) : []);
    } catch { setPurchases([]); }
  };

  const openPay = (p: CreditPurchase) => {
    const remaining = p.totalUsd - p.paidAmount;
    setPayingPurchase(p);
    setPayForm({ amount: remaining.toFixed(2), method: "efectivo", reference: "", notes: "" });
  };

  const submitPayment = async () => {
    if (!payingPurchase) return;
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { toast.error("Monto invalido"); return; }
    try {
      const res = await authFetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: payingPurchase.id, amount, method: payForm.method, reference: payForm.reference, notes: payForm.notes, exchangeRate: bcvRate }),
      });
      const d = await res.json() as any;
      if (!res.ok) throw new Error(d.error);
      toast.success("Abono registrado");
      setPayingPurchase(null);
      if (selected) await openSupplier(selected);
      await load();
    } catch (e: any) { toast.error(e.message || "Error al registrar abono"); }
  };

  const totalOwed = suppliers.reduce((s, x) => s + x.totalOwedUsd, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold">Cuentas por Pagar</h2>
        <Badge variant="secondary" className="text-sm">Total adeudado: {currency} {totalOwed.toFixed(2)}</Badge>
      </div>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Cargando...</p>
      ) : suppliers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No hay compras a credito pendientes</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {suppliers.map((s) => (
            <Card key={s.supplierId} className={`cursor-pointer hover:bg-muted/40 transition ${s.overdue ? "border-destructive/50" : ""}`} onClick={() => openSupplier(s)}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.supplierName}</p>
                  <p className="text-xs text-muted-foreground">{s.purchaseCount} compra(s) pendiente(s){s.oldestDueDate ? ` · vence ${new Date(s.oldestDueDate).toLocaleDateString("es-VE")}` : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-destructive">{currency} {s.totalOwedUsd.toFixed(2)}</p>
                  {s.overdue && <Badge variant="destructive" className="text-[10px]">Vencido</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detalle del proveedor: compras a credito */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.supplierName}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {purchases.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Sin compras pendientes</p>
            ) : purchases.map((p) => {
              const remaining = p.totalUsd - p.paidAmount;
              return (
                <div key={p.id} className="border rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">Compra {p.number || p.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("es-VE")}{p.dueDate ? ` · vence ${new Date(p.dueDate).toLocaleDateString("es-VE")}` : ""}</p>
                    <p className="text-xs">Pagado {currency} {p.paidAmount.toFixed(2)} de {currency} {p.totalUsd.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-destructive">{currency} {remaining.toFixed(2)}</span>
                    <Button size="sm" onClick={() => openPay(p)}>Abonar</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Registrar abono */}
      <Dialog open={!!payingPurchase} onOpenChange={(o) => { if (!o) setPayingPurchase(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Abono</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Monto ({currency})</Label>
              <Input type="number" step="0.01" min="0" value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Metodo de Pago</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={payForm.method} onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Referencia (opcional)</Label>
              <Input value={payForm.reference} onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={submitPayment}>Confirmar Abono</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
