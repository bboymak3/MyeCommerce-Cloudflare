"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

interface Sale {
  id: string;
  date: string;
  total: number;
  totalBs: number;
  paymentMethod: string;
  customerName: string;
  items: SaleItem[];
}

interface SaleItem {
  id: string;
  productId: string;
  productName?: string;
  product?: { name: string; price: number };
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Devolution {
  id: string;
  saleId: string;
  date: string;
  reason: string;
  totalUsd: number;
  totalBs: number;
  exchangeRate: number;
  status: string;
  sale?: Sale;
  items: DevolutionItem[];
}

interface DevolutionItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface DevolutionsTabProps {
  bcvRate: number;
  currency: string;
}

export default function DevolutionsTab({ bcvRate, currency }: DevolutionsTabProps) {
  const [devolutions, setDevolutions] = useState<Devolution[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleSearch, setSaleSearch] = useState("");
  const [reason, setReason] = useState("");
  const [returnItems, setReturnItems] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  const loadDevolutions = useCallback(async () => {
    try {
      const res = await authFetch("/api/devolutions?limit=50");
      const data = await res.json();
      setDevolutions(data);
    } catch {
      toast.error("Error al cargar devoluciones");
    }
  }, []);

  const loadSales = useCallback(async () => {
    try {
      const res = await authFetch("/api/sales?limit=100");
      const data = await res.json();
      setSales(data);
    } catch {
      toast.error("Error al cargar ventas");
    }
  }, []);

  useEffect(() => {
    loadDevolutions();
    loadSales();
  }, [loadDevolutions, loadSales]);

  const openNewDevolution = () => {
    setSelectedSale(null);
    setSaleSearch("");
    setReason("");
    setReturnItems(new Map());
    setShowNewDialog(true);
  };

  const selectSale = (sale: Sale) => {
    setSelectedSale(sale);
    setReturnItems(new Map());
  };

  const setReturnQty = (productId: string, qty: number) => {
    setReturnItems((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(productId);
      } else {
        next.set(productId, qty);
      }
      return next;
    });
  };

  const selectedSaleItems = selectedSale?.items || [];

  const totalReturn = selectedSale
    ? selectedSaleItems.reduce((sum, item) => {
        const qty = returnItems.get(item.productId) || 0;
        return sum + qty * item.unitPrice;
      }, 0)
    : 0;

  const submitDevolution = async () => {
    if (!selectedSale) {
      toast.error("Seleccione una venta");
      return;
    }
    if (returnItems.size === 0) {
      toast.error("Seleccione al menos un producto a devolver");
      return;
    }
    if (!reason.trim()) {
      toast.error("Indique el motivo de la devolución");
      return;
    }

    try {
      const items = selectedSaleItems
        .filter((item) => (returnItems.get(item.productId) || 0) > 0)
        .map((item) => ({
          productId: item.productId,
          productName: item.product?.name || "Producto",
          quantity: returnItems.get(item.productId)!,
          unitPrice: item.unitPrice,
          total: returnItems.get(item.productId)! * item.unitPrice,
        }));

      const res = await authFetch("/api/devolutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: selectedSale.id,
          reason: reason.trim(),
          status: "completada",
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Devolución registrada exitosamente");
      setShowNewDialog(false);
      loadDevolutions();
    } catch (error: any) {
      toast.error(error.message || "Error al registrar devolución");
    }
  };

  const filteredSales = sales.filter(
    (s) =>
      s.id.toLowerCase().includes(saleSearch.toLowerCase()) ||
      s.customerName.toLowerCase().includes(saleSearch.toLowerCase())
  );

  const getSaleTotalReturned = (saleId: string) => {
    return devolutions
      .filter((d) => d.saleId === saleId)
      .reduce((sum, d) => sum + d.totalUsd, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Devoluciones de Ventas</h2>
        <Button size="sm" onClick={openNewDevolution}>
          + Nueva Devolución
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{devolutions.length}</p>
            <p className="text-xs text-muted-foreground">Total Devoluciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">
              ${devolutions.reduce((s, d) => s + d.totalUsd, 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Total Devuelto ($)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">
              Bs {devolutions.reduce((s, d) => s + d.totalBs, 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Total Devuelto (Bs)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">
              {devolutions.filter((d) => d.status === "completada").length}
            </p>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Devoluciones */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Fecha</th>
                  <th className="text-left p-2 font-medium">Venta ID</th>
                  <th className="text-left p-2 font-medium">Cliente</th>
                  <th className="text-left p-2 font-medium">Motivo</th>
                  <th className="text-right p-2 font-medium">Total ($)</th>
                  <th className="text-right p-2 font-medium">Total (Bs)</th>
                  <th className="text-center p-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {devolutions.map((dev) => (
                  <tr key={dev.id} className="border-t hover:bg-muted/30">
                    <td className="p-2 text-xs">
                      {new Date(dev.date).toLocaleString("es-VE")}
                    </td>
                    <td className="p-2 text-xs font-mono">{dev.saleId.slice(0, 8)}</td>
                    <td className="p-2 text-xs">{dev.sale?.customerName || "-"}</td>
                    <td className="p-2 text-xs">{dev.reason}</td>
                    <td className="p-2 text-right text-destructive font-medium">
                      -${dev.totalUsd.toFixed(2)}
                    </td>
                    <td className="p-2 text-right text-destructive font-medium">
                      -Bs {dev.totalBs.toFixed(2)}
                    </td>
                    <td className="p-2 text-center">
                      <Badge
                        variant={dev.status === "completada" ? "success" : "warning"}
                      >
                        {dev.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {devolutions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      No hay devoluciones registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo Nueva Devolución */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Devolución</DialogTitle>
          </DialogHeader>

          {!selectedSale ? (
            <div className="space-y-3">
              <Label>Buscar venta por ID o nombre del cliente</Label>
              <Input
                placeholder="Buscar venta..."
                value={saleSearch}
                onChange={(e) => setSaleSearch(e.target.value)}
              />
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredSales.map((sale) => {
                  const returned = getSaleTotalReturned(sale.id);
                  const canReturn = sale.total - returned > 0;
                  return (
                    <button
                      key={sale.id}
                      onClick={() => canReturn && selectSale(sale)}
                      disabled={!canReturn}
                      className={`w-full text-left p-3 rounded border ${
                        canReturn
                          ? "hover:bg-accent cursor-pointer"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-mono text-xs">{sale.id.slice(0, 8)}</span>
                          <span className="text-sm ml-2">
                            {sale.customerName || "Cliente General"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">${sale.total.toFixed(2)}</span>
                          {returned > 0 && (
                            <span className="text-xs text-destructive ml-1">
                              (devueltos: ${returned.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(sale.date).toLocaleString("es-VE")} - {sale.items.length} productos
                      </div>
                    </button>
                  );
                })}
                {filteredSales.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No se encontraron ventas
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    Venta: {selectedSale.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedSale.date).toLocaleString("es-VE")} -{" "}
                    {selectedSale.customerName || "Cliente General"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSale(null);
                    setSaleSearch("");
                  }}
                >
                  Cambiar venta
                </Button>
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Productos a devolver</Label>
                <div className="space-y-2">
                  {selectedSaleItems.map((item) => {
                    const qty = returnItems.get(item.productId) || 0;
                    return (
                      <div
                        key={item.productId}
                        className="flex items-center gap-3 p-2 rounded border"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.product?.name || item.productId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {currency} {item.unitPrice.toFixed(2)} c/u - Vendidos: {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-7 h-7"
                            onClick={() => setReturnQty(item.productId, qty - 1)}
                            disabled={qty <= 0}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center font-medium">{qty}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-7 h-7"
                            onClick={() =>
                              setReturnQty(item.productId, Math.min(qty + 1, item.quantity))
                            }
                            disabled={qty >= item.quantity}
                          >
                            +
                          </Button>
                        </div>
                        {qty > 0 && (
                          <div className="text-right w-20">
                            <p className="text-sm font-medium text-destructive">
                              -${(qty * item.unitPrice).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Motivo de la devolución *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describa el motivo de la devolución..."
                  rows={2}
                />
              </div>

              <Separator />

              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">
                  Total venta: ${selectedSale.total.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ya devuelto: ${getSaleTotalReturned(selectedSale.id).toFixed(2)}
                </p>
                <p className="text-lg font-bold text-destructive">
                  Esta devolución: -${totalReturn.toFixed(2)}
                </p>
                <p className="text-lg font-bold text-destructive">
                  En Bs: -Bs {(totalReturn * bcvRate).toFixed(2)}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedSale(null);
                    setSaleSearch("");
                  }}
                >
                  Volver
                </Button>
                <Button
                  className="flex-1"
                  onClick={submitDevolution}
                  disabled={totalReturn <= 0 || !reason.trim()}
                >
                  Confirmar Devolución
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
