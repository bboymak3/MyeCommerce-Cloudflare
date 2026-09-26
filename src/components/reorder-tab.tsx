"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

interface Suggestion {
  productId: string;
  productName: string;
  barcode: string;
  stock: number;
  minStock: number;
  cost: number;
  suggestedQty: number;
  supplierId: string | null;
  supplierName: string | null;
}
interface SupplierGroup { supplierId: string; supplierName: string; items: Suggestion[]; }

export default function ReorderTab({ currency }: { currency: string }) {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierGroup[]>([]);
  const [unassigned, setUnassigned] = useState<Suggestion[]>([]);
  // Ediciones locales: cantidad/costo por producto, y si esta incluido en la orden
  const [qty, setQty] = useState<Record<string, string>>({});
  const [cost, setCost] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/reorder-suggestions");
      const data = await res.json() as any;
      const sups: SupplierGroup[] = Array.isArray(data.suppliers) ? data.suppliers : [];
      const un: Suggestion[] = Array.isArray(data.unassigned) ? data.unassigned : [];
      setSuppliers(sups);
      setUnassigned(un);
      const q: Record<string, string> = {};
      const c: Record<string, string> = {};
      const chk: Record<string, boolean> = {};
      for (const s of [...sups.flatMap((g) => g.items), ...un]) {
        q[s.productId] = String(s.suggestedQty);
        c[s.productId] = s.cost.toFixed(2);
        chk[s.productId] = true;
      }
      setQty(q); setCost(c); setChecked(chk);
    } catch { setSuppliers([]); setUnassigned([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groupTotal = (items: Suggestion[]) =>
    items.filter((i) => checked[i.productId]).reduce((s, i) => s + (parseFloat(qty[i.productId]) || 0) * (parseFloat(cost[i.productId]) || 0), 0);

  const generateOrder = async (supplierId: string | null, items: Suggestion[]) => {
    const selected = items.filter((i) => checked[i.productId] && (parseFloat(qty[i.productId]) || 0) > 0);
    if (selected.length === 0) { toast.error("Selecciona al menos un producto"); return; }
    setGenerating(supplierId || "sin-proveedor");
    try {
      const orderItems = selected.map((i) => {
        const q = parseFloat(qty[i.productId]) || 0;
        const c = parseFloat(cost[i.productId]) || 0;
        return { productId: i.productId, productName: i.productName, quantity: q, unitCost: c, total: q * c, isBox: false };
      });
      const res = await authFetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, items: orderItems, notes: "Generada desde sugerencias de reposicion" }),
      });
      const d = await res.json() as any;
      if (!res.ok) throw new Error(d.error);
      toast.success(`Orden de compra registrada: ${orderItems.length} producto(s)`);
      await load();
    } catch (e: any) { toast.error(e.message || "Error al generar la orden"); }
    finally { setGenerating(null); }
  };

  const renderGroup = (title: string, supplierId: string | null, items: Suggestion[]) => (
    <Card key={supplierId || "sin-proveedor"}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary">{currency} {groupTotal(items).toFixed(2)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((i) => (
          <div key={i.productId} className="flex items-center gap-2 flex-wrap border rounded-lg p-2">
            <input
              type="checkbox"
              checked={!!checked[i.productId]}
              onChange={(e) => setChecked((p) => ({ ...p, [i.productId]: e.target.checked }))}
              className="w-4 h-4 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{i.productName}</p>
              <p className="text-xs text-muted-foreground">
                Stock {i.stock} / minimo {i.minStock}
                {i.stock <= 0 && <Badge variant="destructive" className="ml-1 text-[9px]">AGOTADO</Badge>}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Cant.</span>
              <Input
                type="number" min="1" value={qty[i.productId] || ""}
                onChange={(e) => setQty((p) => ({ ...p, [i.productId]: e.target.value }))}
                className="w-20 h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Costo</span>
              <Input
                type="number" min="0" step="0.01" value={cost[i.productId] || ""}
                onChange={(e) => setCost((p) => ({ ...p, [i.productId]: e.target.value }))}
                className="w-24 h-8 text-sm"
              />
            </div>
          </div>
        ))}
        <Button
          className="w-full mt-2"
          onClick={() => generateOrder(supplierId, items)}
          disabled={generating === (supplierId || "sin-proveedor")}
        >
          {generating === (supplierId || "sin-proveedor") ? "Generando..." : "Generar Orden de Compra"}
        </Button>
      </CardContent>
    </Card>
  );

  const totalProducts = suppliers.reduce((s, g) => s + g.items.length, 0) + unassigned.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold">Sugerencias de Reposicion</h2>
        <Badge variant="secondary">{totalProducts} producto(s) por debajo del minimo</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Calculado con el stock minimo de cada producto y su ritmo de venta de los ultimos 30 dias.
        El proveedor sugerido es el ultimo con el que se compro ese producto.
      </p>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Calculando...</p>
      ) : totalProducts === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Todos los productos estan sobre su stock minimo</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {suppliers.map((g) => renderGroup(g.supplierName, g.supplierId, g.items))}
          {unassigned.length > 0 && renderGroup("Sin proveedor asignado", null, unassigned)}
        </div>
      )}
    </div>
  );
}
