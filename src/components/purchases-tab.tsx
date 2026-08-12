"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ShoppingCart, Plus, Trash2, Search, Truck, ChevronDown, ChevronUp, Filter, Printer, Package, Box } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

interface Supplier { id: string; name: string; rif: string; phone?: string; }
interface Product { id: string; name: string; cost: number; stock: number; price?: number; unitsPerBox?: number; boxPrice?: number; }
interface PurchaseItem {
  productId: string; productName: string; quantity: number; unitCost: number; total: number;
  isBox?: boolean; unitsPerBox?: number; boxQty?: number; boxCost?: number;
  calcUnitCost?: number; calcMargin?: number; calcPrice?: number;
}

interface PurchaseRecord {
  id: string; date: string; number: string; totalUsd: number; totalBs: number;
  exchangeRate: number; notes: string; supplier?: { id: string; name: string; rif: string; };
  items: PurchaseItem[];
}

export default function PurchasesTab({ bcvRate = 36.5 }: { bcvRate?: number }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSupplier, setFilterSupplier] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch("/api/suppliers", {}).then(r => r.json()),
      authFetch("/api/products", {}).then(r => r.json()),
      authFetch("/api/purchases", {}).then(r => r.json()),
    ]).then(([s, p, pur]) => {
      setSuppliers(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
      setPurchases(Array.isArray(pur) ? pur : []);
    }).catch(() => toast.error("Error al cargar datos"))
    .finally(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10);

  const filteredPurchases = filterSupplier
    ? purchases.filter(p => p.supplier?.id === filterSupplier || (!p.supplier && filterSupplier === '__none__'))
    : purchases;

  const supplierTotals: Record<string, { name: string; rif: string; totalUsd: number; count: number }> = {};
  for (const p of purchases) {
    const key = p.supplier?.id || '__none__';
    const name = p.supplier?.name || 'Sin proveedor';
    const rif = p.supplier?.rif || '';
    if (!supplierTotals[key]) supplierTotals[key] = { name, rif, totalUsd: 0, count: 0 };
    supplierTotals[key].totalUsd += p.totalUsd || 0;
    supplierTotals[key].count++;
  }
  const sortedSupplierTotals = Object.entries(supplierTotals).sort((a, b) => b[1].totalUsd - a[1].totalUsd);

  // Agregar producto — por defecto como unidad
  const addItem = (product: Product) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.isBox) {
          return prev.map(i => i.productId === product.id
            ? { ...i, boxQty: (i.boxQty || 0) + 1, quantity: ((i.boxQty || 0) + 1) * (i.unitsPerBox || 0), total: parseFloat((((i.boxQty || 0) + 1) * (i.boxCost || 0)).toFixed(2)) }
            : i);
        }
        return prev.map(i => i.productId === product.id
          ? { ...i, quantity: i.quantity + 1, total: parseFloat(((i.quantity + 1) * i.unitCost).toFixed(2)) }
          : i);
      }
      return [...prev, {
        productId: product.id, productName: product.name, quantity: 1,
        unitCost: product.cost || 0, total: product.cost || 0,
        isBox: false, unitsPerBox: product.unitsPerBox || 0, boxQty: 0,
        boxCost: 0, calcUnitCost: 0, calcMargin: 0, calcPrice: 0,
      }];
    });
    setProductSearch("");
    setShowProductDropdown(false);
  };

  // Agregar producto como bulto
  const addItemAsBox = (product: Product) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id && i.isBox);
      if (existing) {
        return prev.map(i => i.productId === product.id && i.isBox
          ? {
            ...i,
            boxQty: (i.boxQty || 0) + 1,
            quantity: ((i.boxQty || 0) + 1) * (i.unitsPerBox || 1),
            total: parseFloat((((i.boxQty || 0) + 1) * (i.boxCost || 0)).toFixed(2)),
            calcUnitCost: (i.unitsPerBox || 1) > 0 ? parseFloat(((i.boxCost || 0) / (i.unitsPerBox || 1)).toFixed(4)) : 0,
          }
          : i);
      }
      const upb = product.unitsPerBox || 1;
      const bxPrice = product.boxPrice || (product.cost ? product.cost * upb : 0);
      return [...prev, {
        productId: product.id, productName: product.name,
        quantity: upb, unitCost: upb > 0 ? parseFloat((bxPrice / upb).toFixed(4)) : 0,
        total: bxPrice,
        isBox: true, unitsPerBox: upb, boxQty: 1, boxCost: bxPrice,
        calcUnitCost: upb > 0 ? parseFloat((bxPrice / upb).toFixed(4)) : 0,
        calcMargin: 0, calcPrice: 0,
      }];
    });
    setProductSearch("");
    setShowProductDropdown(false);
  };

  // Toggle entre bulto/unidad
  const toggleBoxMode = (idx: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (item.isBox) {
        // Cambiar a unidad: qty se convierte a 1, costo = costo unitario calculado
        return { ...item, isBox: false, quantity: 1, unitCost: item.calcUnitCost || item.unitCost, total: item.calcUnitCost || item.unitCost };
      }
      // Cambiar a bulto
      const upb = item.unitsPerBox || 1;
      return { ...item, isBox: true, boxQty: 1, boxCost: item.unitCost, quantity: upb, calcUnitCost: item.unitCost, total: item.unitCost * 1 };
    }));
  };

  // Actualizar item
  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: parseFloat(value) || 0 };

      if (updated.isBox) {
        // Recalcular bulto
        const upb = Math.max(1, updated.unitsPerBox || 1);
        const bQty = Math.max(0, updated.boxQty || 0);
        const bCost = Math.max(0, updated.boxCost || 0);
        updated.quantity = parseFloat((bQty * upb).toFixed(2));
        updated.total = parseFloat((bQty * bCost).toFixed(2));
        updated.calcUnitCost = upb > 0 ? parseFloat((bCost / upb).toFixed(4)) : 0;
        // Calcular precio de venta si hay margen
        const margin = updated.calcMargin || 0;
        updated.calcPrice = updated.calcUnitCost > 0 && margin >= 0
          ? parseFloat((updated.calcUnitCost * (1 + margin / 100)).toFixed(2))
          : 0;
        updated.unitCost = updated.calcUnitCost;
      } else {
        updated.total = parseFloat((updated.quantity * updated.unitCost).toFixed(2));
      }
      return updated;
    }));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalUsd = items.reduce((sum, i) => sum + i.total, 0);
  const totalBs = parseFloat((totalUsd * bcvRate).toFixed(2));

  const savePurchase = async () => {
    if (items.length === 0) { toast.error("Agregue al menos un producto"); return; }
    setSaving(true);
    try {
      const res = await authFetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: supplierId || null, items, notes, exchangeRate: bcvRate }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Compra registrada: $${totalUsd.toFixed(2)} (${items.length} productos)`);
      setItems([]); setNotes(""); setSupplierId("");
      const [pur, prods] = await Promise.all([
        authFetch("/api/purchases", {}).then(r => r.json()),
        authFetch("/api/products", {}).then(r => r.json()),
      ]);
      setPurchases(Array.isArray(pur) ? pur : []);
      setProducts(Array.isArray(prods) ? prods : []);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const deletePurchase = async (id: string) => {
    if (!confirm("Eliminar esta compra? Se restaurara el stock.")) return;
    try {
      await authFetch(`/api/purchases?id=${id}`, { method: "DELETE" });
      toast.success("Compra eliminada, stock restaurado");
      setPurchases(prev => prev.filter(p => p.id !== id));
    } catch { toast.error("Error al eliminar"); }
  };

  const printPurchaseTicket = (purchase: PurchaseRecord) => {
    const d = new Date(purchase.date);
    const dateStr = d.toLocaleDateString('es-VE');
    const timeStr = d.toLocaleTimeString('es-VE');
    const fmtN = (n: number) => n.toFixed(2).replace('.', ',');

    const itemsHtml = purchase.items?.map((item: PurchaseItem) => {
      const isBox = (item as any).isBox;
      const qtyLabel = isBox
        ? `${(item as any).boxQty} bulto(s) x ${(item as any).unitsPerBox} uds = ${item.quantity} uds`
        : `${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)} uds`;
      const costLabel = isBox
        ? `$${fmtN((item as any).boxCost || 0)}/bulto ($${fmtN(item.unitCost || 0)}/ud)`
        : `$${fmtN(item.unitCost || 0)}/ud`;
      const marginInfo = isBox && (item as any).calcMargin > 0
        ? ` → Precio venta ud: $${fmtN((item as any).calcPrice || 0)} (${(item as any).calcMargin}% margen)`
        : '';

      return `<tr style="border-bottom:1px dotted #ccc">
        <td style="padding:2px;width:40%;vertical-align:top;word-wrap:break-word">${item.productName || 'N/A'}${marginInfo ? `<br><span style="font-size:9px;color:#666">${marginInfo}</span>` : ''}</td>
        <td style="padding:2px;width:25%;text-align:right;vertical-align:top">${costLabel}</td>
        <td style="padding:2px;width:15%;text-align:right;vertical-align:top">${qtyLabel}</td>
        <td style="padding:2px;width:20%;text-align:right;vertical-align:top;font-weight:bold">$${fmtN(item.total || 0)}</td>
      </tr>`;
    }).join('');

    const w = window.open('', '_blank', 'width=380,height=700');
    if (!w) { toast.error('No se pudo abrir ventana de impresion'); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Comprobante Compra</title>
      <style>
        @page{size:80mm auto;margin:0}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',monospace;font-size:11px;width:80mm;margin:0 auto;padding:3mm 4mm;color:#000}
        .c{text-align:center}.b{font-weight:bold}.s{font-size:10px}
        table{width:100%;border-collapse:collapse}
        .line{border-top:1px solid #000;margin:4px 0}
        .line-d{border-top:2px double #000;margin:5px 0}
        @media print{html,body{width:80mm!important;margin:0 auto!important;padding:3mm 4mm!important}}
      </style></head><body>
      <div class="b" style="font-size:14px">COMPROBANTE DE COMPRA</div>
      <div class="line-d"></div>
      <div class="s">Doc: ${purchase.id.slice(0, 8)}</div>
      <div class="s">Fecha: ${dateStr}  ${timeStr}</div>
      ${purchase.supplier ? `
        <div class="s" style="margin-top:3px"><span class="b">Proveedor:</span> ${purchase.supplier.name}</div>
        ${purchase.supplier.rif ? `<div class="s">RIF: ${purchase.supplier.rif}</div>` : ''}
      ` : '<div class="s" style="margin-top:3px">Proveedor: Sin asignar</div>'}
      <div class="s">Tasa: 1$ = ${fmtN(purchase.exchangeRate || bcvRate)} Bs</div>
      <div class="line"></div>
      <table>
        <tr style="border-bottom:1px solid #000">
          <th style="text-align:left;padding:2px;font-size:9px">ARTICULO</th>
          <th style="text-align:right;padding:2px;font-size:9px">COSTO</th>
          <th style="text-align:right;padding:2px;font-size:9px">CANT.</th>
          <th style="text-align:right;padding:2px;font-size:9px">TOTAL</th>
        </tr>
        ${itemsHtml}
      </table>
      <div class="line-d"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold">
        <span>TOTAL:</span><span>$ ${fmtN(purchase.totalUsd || 0)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px">
        <span class="s">En Bolivares:</span><span>Bs. ${fmtN(purchase.totalBs || 0)}</span>
      </div>
      ${purchase.notes ? `<div class="line" style="margin-top:6px"></div><div class="s" style="font-style:italic">Nota: ${purchase.notes}</div>` : ''}
      <div class="line" style="margin-top:8px"></div>
      <div class="c s">MyeCommerce POS</div>
      <div class="c s">Comprobante de compra - No fiscal</div>
      <script>window.onload=function(){window.print()}</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      {/* New Purchase Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Registrar Compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Proveedor</Label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} {s.rif ? `(${s.rif})` : ''}</option>)}
              </select>
            </div>
            <div>
              <Label>Tasa de Cambio</Label>
              <Input value={`1 USD = ${bcvRate.toFixed(2)} Bs`} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." />
            </div>
          </div>

          <Separator />

          {/* Product search */}
          <div className="relative">
            <Label>Agregar Producto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                onFocus={() => setShowProductDropdown(true)} onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                placeholder="Buscar producto por nombre..." className="pl-9" />
              {showProductDropdown && productSearch && (
                <div className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-56 overflow-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No se encontraron productos</p>
                  ) : filteredProducts.map((p) => (
                    <div key={p.id} className="border-b last:border-0">
                      <button onMouseDown={() => addItem(p)} className="w-full text-left p-2 hover:bg-muted/50 text-sm flex justify-between">
                        <span>{p.name}</span>
                        <span className="text-muted-foreground text-xs">Stock: {p.stock} | $ {p.cost.toFixed(2)}</span>
                      </button>
                      <div className="flex justify-end px-2 pb-1">
                        <button onMouseDown={() => addItemAsBox(p)} className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-1" title="Agregar como bulto">
                          <Package className="h-3 w-3" /> Agregar como bulto
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Producto</th>
                    <th className="text-center p-2 w-16">Modo</th>
                    {items.some(i => i.isBox) && <th className="text-center p-2 w-16">Bultos</th>}
                    {items.some(i => i.isBox) && <th className="text-center p-2 w-16">Uds/Caja</th>}
                    {items.some(i => i.isBox) && <th className="text-center p-2 w-24">Costo Bulto</th>}
                    {items.some(i => i.isBox) && <th className="text-center p-2 w-20">Margen %</th>}
                    {items.some(i => i.isBox) && <th className="text-center p-2 w-20">Precio Ud</th>}
                    <th className="text-center p-2 w-24">Costo Ud</th>
                    <th className="text-center p-2 w-20">Total Uds</th>
                    <th className="text-right p-2 w-24">Total $</th>
                    <th className="p-1 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={`${item.productId}-${item.isBox ? 'box' : 'unit'}`} className="border-t">
                      <td className="p-2 font-medium text-xs">
                        {item.productName}
                        {item.isBox && <Badge variant="secondary" className="ml-1 text-[10px]">BULTO</Badge>}
                      </td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => toggleBoxMode(idx)} className={`p-1 rounded text-xs transition-colors ${item.isBox ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'}`} title={item.isBox ? 'Cambiar a unidad' : 'Cambiar a bulto'}>
                          {item.isBox ? <Package className="h-4 w-4" /> : <Box className="h-4 w-4" />}
                        </button>
                      </td>
                      {item.isBox ? (
                        <>
                          <td className="p-1">
                            <Input type="number" step="1" min="1" value={item.boxQty || 0} onChange={(e) => updateItem(idx, 'boxQty', e.target.value)} className="h-8 text-center" />
                          </td>
                          <td className="p-1">
                            <Input type="number" step="1" min="1" value={item.unitsPerBox || 0} onChange={(e) => updateItem(idx, 'unitsPerBox', e.target.value)} className="h-8 text-center" />
                          </td>
                          <td className="p-1">
                            <Input type="number" step="0.01" min="0" value={item.boxCost || 0} onChange={(e) => updateItem(idx, 'boxCost', e.target.value)} className="h-8 text-center" />
                          </td>
                          <td className="p-1">
                            <Input type="number" step="0.1" min="0" value={item.calcMargin || 0} onChange={(e) => updateItem(idx, 'calcMargin', e.target.value)} className="h-8 text-center" />
                          </td>
                          <td className="p-1 text-center">
                            <span className={`text-xs font-bold ${item.calcPrice > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {item.calcPrice > 0 ? `$${item.calcPrice.toFixed(2)}` : '—'}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          {items.some(i => i.isBox) && <td></td>}
                          {items.some(i => i.isBox) && <td></td>}
                          {items.some(i => i.isBox) && <td></td>}
                          {items.some(i => i.isBox) && <td></td>}
                          {items.some(i => i.isBox) && <td></td>}
                        </>
                      )}
                      <td className="p-1">
                        {!item.isBox && <Input type="number" step="0.0001" min="0" value={item.unitCost} onChange={(e) => updateItem(idx, 'unitCost', e.target.value)} className="h-8 text-center" />}
                        {item.isBox && <span className="text-xs text-muted-foreground text-center block">$ {(item.calcUnitCost || 0).toFixed(4)}</span>}
                      </td>
                      <td className="p-1">
                        {item.isBox ? (
                          <span className="text-xs text-muted-foreground text-center block">{item.quantity} uds</span>
                        ) : (
                          <Input type="number" step="1" min="0" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="h-8 text-center text-xs font-medium" />
                        )}
                      </td>
                      <td className="p-2 text-right font-bold">${item.total.toFixed(2)}</td>
                      <td className="p-1">
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={8 + (items.some(i => i.isBox) ? 5 : 0)} className="p-2 text-right font-bold">TOTAL:</td>
                    <td className="p-2 text-right font-bold text-lg">${totalUsd.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={8 + (items.some(i => i.isBox) ? 5 : 0)} className="p-1 text-right text-xs text-muted-foreground">En Bolivares:</td>
                    <td className="p-1 text-right text-xs font-bold text-muted-foreground">Bs. {totalBs.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>

              {/* Resumen de bultos */}
              {items.some(i => i.isBox) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border-t text-xs space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1"><Package className="h-3 w-3" /> Resumen de Bultos:</div>
                  {items.filter(i => i.isBox).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <span>{item.productName}:</span>
                      <span>{item.boxQty} bulto(s) x {item.unitsPerBox} uds = {item.quantity} uds</span>
                      <span>• Costo ud: $ {(item.calcUnitCost || 0).toFixed(4)}</span>
                      {item.calcPrice > 0 && <span className="text-green-600 dark:text-green-400">• Precio venta ud: $ {item.calcPrice.toFixed(2)}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="p-2">
                <Button className="w-full" onClick={savePurchase} disabled={saving || items.length === 0}>
                  {saving ? "Registrando..." : `Registrar Compra — ${items.length} producto(s), $${totalUsd.toFixed(2)}`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen por Proveedor */}
      {sortedSupplierTotals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Truck className="h-5 w-5" /> Resumen por Proveedor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Proveedor</th>
                    <th className="text-center p-2">Compras</th>
                    <th className="text-right p-2">Total USD</th>
                    <th className="text-right p-2">Total Bs</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSupplierTotals.map(([key, data]) => (
                    <tr key={key} className={`border-t cursor-pointer hover:bg-muted/30 ${filterSupplier === key ? 'bg-muted/50' : ''}`}
                        onClick={() => setFilterSupplier(filterSupplier === key ? '' : key)}>
                      <td className="p-2">
                        <span className="font-medium">{data.name}</span>
                        {data.rif && <span className="text-muted-foreground text-xs ml-2">({data.rif})</span>}
                      </td>
                      <td className="p-2 text-center">{data.count}</td>
                      <td className="p-2 text-right font-bold">${data.totalUsd.toFixed(2)}</td>
                      <td className="p-2 text-right text-xs text-muted-foreground">Bs. {(data.totalUsd * bcvRate).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-bold">
                    <td className="p-2">TOTAL GENERAL</td>
                    <td className="p-2 text-center">{purchases.length}</td>
                    <td className="p-2 text-right">${purchases.reduce((s, p) => s + (p.totalUsd || 0), 0).toFixed(2)}</td>
                    <td className="p-2 text-right text-xs">Bs. {purchases.reduce((s, p) => s + (p.totalBs || 0), 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Historial de Compras</CardTitle>
            {filterSupplier && (
              <Badge variant="secondary" className="cursor-pointer gap-1" onClick={() => setFilterSupplier("")}>
                <Filter className="h-3 w-3" />
                {suppliers.find(s => s.id === filterSupplier)?.name || 'Sin proveedor'}
                <span className="ml-1 text-destructive">x</span>
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-1 w-8"></th>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Proveedor</th>
                  <th className="text-center p-2">Items</th>
                  <th className="text-right p-2">Total USD</th>
                  <th className="text-right p-2">Total Bs</th>
                  <th className="text-center p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p) => {
                  const isExpanded = expandedId === p.id;
                  return (
                    <>
                      <tr key={p.id} className={`border-t hover:bg-muted/30 cursor-pointer ${isExpanded ? 'bg-muted/20' : ''}`}
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                        <td className="p-1 text-center text-muted-foreground">
                          {p.items?.length > 0 && (isExpanded ? <ChevronUp className="h-4 w-4 mx-auto" /> : <ChevronDown className="h-4 w-4 mx-auto" />)}
                        </td>
                        <td className="p-2 text-xs">{new Date(p.date).toLocaleDateString("es-VE")}</td>
                        <td className="p-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Truck className="h-3 w-3 shrink-0" />
                            <span className="font-medium">{p.supplier?.name || "Sin proveedor"}</span>
                          </div>
                          {p.supplier?.rif && <span className="text-muted-foreground text-[10px] block ml-4">{p.supplier.rif}</span>}
                        </td>
                        <td className="p-2 text-center">{p.items?.length || 0}</td>
                        <td className="p-2 text-right font-bold">${(p.totalUsd || 0).toFixed(2)}</td>
                        <td className="p-2 text-right text-xs text-muted-foreground">Bs. {(p.totalBs || 0).toFixed(2)}</td>
                        <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => printPurchaseTicket(p)} className="h-7 text-xs gap-1" title="Imprimir comprobante">
                              <Printer className="h-3 w-3" /> Ticket
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deletePurchase(p.id)} className="h-7 text-xs text-destructive">Eliminar</Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && p.items?.length > 0 && (
                        <tr key={`${p.id}-detail`} className="border-t bg-muted/10">
                          <td colSpan={7} className="p-0">
                            <div className="p-3 pl-10">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left py-1">Producto</th>
                                    <th className="text-center py-1 w-16">Modo</th>
                                    <th className="text-center py-1 w-20">Cantidad</th>
                                    <th className="text-center py-1 w-24">Costo Unit.</th>
                                    <th className="text-right py-1 w-24">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.items.map((item, idx) => (
                                    <tr key={idx} className="border-t border-muted/30">
                                      <td className="py-1">{item.productName || 'N/A'}</td>
                                      <td className="py-1 text-center">{(item as any).isBox ? <Badge variant="secondary" className="text-[9px]">BULTO</Badge> : 'Ud'}</td>
                                      <td className="py-1 text-center">
                                        {(item as any).isBox
                                          ? <span>{(item as any).boxQty} x {(item as any).unitsPerBox} = {item.quantity}</span>
                                          : item.quantity}
                                      </td>
                                      <td className="py-1 text-center">${(item.unitCost || 0).toFixed(4)}</td>
                                      <td className="py-1 text-right font-medium">${(item.total || 0).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {p.notes && <p className="text-muted-foreground text-[10px] mt-2 italic">Nota: {p.notes}</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {filteredPurchases.length === 0 && (
                  <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">{loading ? "Cargando..." : "No hay compras registradas"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
