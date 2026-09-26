"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

interface CashShift {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  openedAt: string;
  closedAt: string | null;
  openingCashUsd: number;
  openingCashBs: number;
  closingCashUsd: number | null;
  closingCashBs: number | null;
  expectedCashUsd: number;
  expectedCashBs: number;
  diffUsd: number;
  diffBs: number;
  salesCount: number;
  totalUsd: number;
  totalBs: number;
  status: "open" | "closed";
  notes: string;
}

export default function CashShiftsTab({ currency }: { currency: string }) {
  const [current, setCurrent] = useState<CashShift | null>(null);
  const [history, setHistory] = useState<CashShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState({ openingCashUsd: "0", openingCashBs: "0", notes: "" });
  const [closeForm, setCloseForm] = useState({ closingCashUsd: "", closingCashBs: "", notes: "" });
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [curRes, histRes] = await Promise.all([
        authFetch("/api/cash-shifts?current=1"),
        authFetch("/api/cash-shifts"),
      ]);
      const cur = await curRes.json() as any;
      const hist = await histRes.json() as any;
      setCurrent(cur && cur.id ? cur : null);
      setHistory(Array.isArray(hist) ? hist : []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openShift = async () => {
    setOpening(true);
    try {
      const res = await authFetch("/api/cash-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingCashUsd: parseFloat(openForm.openingCashUsd) || 0,
          openingCashBs: parseFloat(openForm.openingCashBs) || 0,
          notes: openForm.notes,
        }),
      });
      const d = await res.json() as any;
      if (!res.ok) throw new Error(d.error);
      toast.success("Turno de caja abierto");
      setOpenForm({ openingCashUsd: "0", openingCashBs: "0", notes: "" });
      await load();
    } catch (e: any) { toast.error(e.message || "Error al abrir turno"); }
    finally { setOpening(false); }
  };

  const startClose = () => {
    if (!current) return;
    setCloseForm({ closingCashUsd: current.expectedCashUsd.toFixed(2), closingCashBs: current.expectedCashBs.toFixed(2), notes: "" });
  };

  const closeShift = async () => {
    if (!current) return;
    setClosing(true);
    try {
      const res = await authFetch("/api/cash-shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          closingCashUsd: parseFloat(closeForm.closingCashUsd) || 0,
          closingCashBs: parseFloat(closeForm.closingCashBs) || 0,
          notes: closeForm.notes,
        }),
      });
      const d = await res.json() as any;
      if (!res.ok) throw new Error(d.error);
      toast.success("Turno de caja cerrado");
      setCloseForm({ closingCashUsd: "", closingCashBs: "", notes: "" });
      await load();
    } catch (e: any) { toast.error(e.message || "Error al cerrar turno"); }
    finally { setClosing(false); }
  };

  if (loading) return <p className="text-center py-8 text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Turnos de Caja</h2>

      {!current ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Abrir Turno</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Efectivo inicial ($)</Label>
                <Input type="number" step="0.01" min="0" value={openForm.openingCashUsd} onChange={(e) => setOpenForm((f) => ({ ...f, openingCashUsd: e.target.value }))} />
              </div>
              <div>
                <Label>Efectivo inicial (Bs)</Label>
                <Input type="number" step="0.01" min="0" value={openForm.openingCashBs} onChange={(e) => setOpenForm((f) => ({ ...f, openingCashBs: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea value={openForm.notes} onChange={(e) => setOpenForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <Button className="w-full" onClick={openShift} disabled={opening}>{opening ? "Abriendo..." : "Abrir Turno de Caja"}</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-300 dark:border-green-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge className="bg-green-600">Turno Abierto</Badge> {current.userName}
              </CardTitle>
              <span className="text-xs text-muted-foreground">Desde {new Date(current.openedAt).toLocaleString("es-VE")}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="p-2 rounded bg-muted/40"><p className="text-xs text-muted-foreground">Inicial $</p><p className="font-bold">{current.openingCashUsd.toFixed(2)}</p></div>
              <div className="p-2 rounded bg-muted/40"><p className="text-xs text-muted-foreground">Inicial Bs</p><p className="font-bold">{current.openingCashBs.toFixed(2)}</p></div>
              <div className="p-2 rounded bg-muted/40"><p className="text-xs text-muted-foreground">Ventas</p><p className="font-bold">{current.salesCount}</p></div>
              <div className="p-2 rounded bg-muted/40"><p className="text-xs text-muted-foreground">Total</p><p className="font-bold">{currency} {current.totalUsd.toFixed(2)}</p></div>
            </div>

            {closeForm.closingCashUsd === "" ? (
              <Button variant="destructive" className="w-full" onClick={startClose}>Cerrar Turno</Button>
            ) : (
              <div className="space-y-3 border-t pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Efectivo contado ($)</Label>
                    <Input type="number" step="0.01" min="0" value={closeForm.closingCashUsd} onChange={(e) => setCloseForm((f) => ({ ...f, closingCashUsd: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">Esperado: {current.expectedCashUsd.toFixed(2)}</p>
                  </div>
                  <div>
                    <Label>Efectivo contado (Bs)</Label>
                    <Input type="number" step="0.01" min="0" value={closeForm.closingCashBs} onChange={(e) => setCloseForm((f) => ({ ...f, closingCashBs: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">Esperado: {current.expectedCashBs.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <Label>Notas (opcional)</Label>
                  <Textarea value={closeForm.notes} onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setCloseForm({ closingCashUsd: "", closingCashBs: "", notes: "" })}>Cancelar</Button>
                  <Button className="flex-1" onClick={closeShift} disabled={closing}>{closing ? "Cerrando..." : "Confirmar Cierre"}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Historial de Turnos</h3>
        {history.length === 0 ? (
          <p className="text-sm text-center py-4 text-muted-foreground">Sin turnos registrados</p>
        ) : (
          <div className="grid gap-2">
            {history.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.userName} <span className="text-xs text-muted-foreground">({s.userRole})</span></p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.openedAt).toLocaleString("es-VE")}
                      {s.closedAt ? ` - ${new Date(s.closedAt).toLocaleString("es-VE")}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status === "open" ? "Abierto" : "Cerrado"}</Badge>
                    {s.status === "closed" && (
                      <p className={`text-xs font-medium mt-0.5 ${Math.abs(s.diffUsd) > 0.5 || Math.abs(s.diffBs) > 5 ? "text-destructive" : "text-green-600"}`}>
                        Dif: ${s.diffUsd.toFixed(2)} / Bs{s.diffBs.toFixed(2)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
