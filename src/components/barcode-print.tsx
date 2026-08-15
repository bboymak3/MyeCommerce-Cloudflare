"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import JsBarcode from "jsbarcode";

interface Product {
  id: string; name: string; barcode: string; price: number;
  wholesalePrice: number; minWholesaleQty: number; category?: { name: string } | null; stock: number;
}

interface BarcodePrintProps {
  products: Product[];
  bcvRate: number;
  currency: string;
}

export default function BarcodePrint({ products, bcvRate, currency }: BarcodePrintProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [storeName, setStoreName] = useState("Mi Tienda");
  const [labelMode, setLabelMode] = useState<"retail"|"wholesale">("retail");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authFetch("/api/settings").then(r => r.json()).then(s => {
      if (s.storeName) setStoreName(s.storeName);
    }).catch(() => {});
  }, []);

  const categories = Array.from(new Map(products.map(p => [p.category?.name || "", p.category?.name || "Sin categoria"])).values());

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCategory === "all" || (p.category?.name || "Sin categoria") === filterCategory;
    return matchSearch && matchCat && p.barcode;
  });

  const toggleProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else { next.add(id); setQuantityMap(m => ({ ...m, [id]: m[id] || 1 })); }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedProducts.size === filtered.length) {
      setSelectedProducts(new Set());
    } else {
      const all = new Set(filtered.map(p => p.id));
      const newQty: Record<string, number> = {};
      filtered.forEach(p => { newQty[p.id] = quantityMap[p.id] || 1; });
      setQuantityMap(newQty);
      setSelectedProducts(all);
    }
  };

  const setQty = (id: string, qty: number) => {
    if (qty < 1) return;
    setQuantityMap(m => ({ ...m, [id]: qty }));
  };

  const generateBarcode = useCallback((canvasId: string, value: string) => {
    try {
      JsBarcode(`#${canvasId}`, value, {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 2,
      });
    } catch (e) {
      // Si falla el barcode, mostrar texto plano
      const el = document.getElementById(canvasId);
      if (el) {
        const parent = el.parentElement;
        if (parent) {
          const fallback = document.createElement("div");
          fallback.className = "text-center font-mono text-sm";
          fallback.textContent = value;
          el.replaceWith(fallback);
        }
      }
    }
  }, []);

  // Generar barcodes al abrir preview
  useEffect(() => {
    if (showPreview) {
      setTimeout(() => {
        selectedProducts.forEach(id => {
          const product = products.find(p => p.id === id);
          if (product?.barcode) generateBarcode(`barcode-${id}`, product.barcode);
        }, 0);
      }, 100);
    }
  }, [showPreview, selectedProducts, products, generateBarcode]);

  const handlePrint = () => {
    if (selectedProducts.size === 0) {
      toast.error("Seleccione al menos un producto");
      return;
    }
    setShowPreview(true);
  };

  const printLabels = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) { toast.error("Permita ventanas emergentes para imprimir"); return; }

    const categories = Array.from(new Set(products.filter(p => selectedProducts.has(p.id)).map(p => p.category?.name || "Sin categoria")));

    // Generar HTML con barcodes inline como SVG
    const labels = products.filter(p => {
      if (!selectedProducts.has(p.id)) return false;
      if (labelMode === "wholesale" && (!p.wholesalePrice || p.wholesalePrice <= 0)) return false;
      return true;
    }).flatMap(p => {
      const qty = quantityMap[p.id] || 1;
      const labelsArr = [];
      for (let i = 0; i < qty; i++) {
        labelsArr.push(`
          <div class="label">
            <div class="label-store">${storeName}</div>
            <div class="label-name">${p.name.substring(0, 30)}${p.name.length > 30 ? "..." : ""}</div>
            <div class="label-price">$ ${labelMode === "wholesale" && p.wholesalePrice > 0 ? p.wholesalePrice.toFixed(2) : p.price.toFixed(2)}</div>
            ${labelMode === "wholesale" && p.wholesalePrice > 0 ? `<div class="label-wholesale">x${p.minWholesaleQty || ""}+ uds</div>` : ""}
            <svg id="print-barcode-${p.id}-${i}"></svg>
            <div class="label-barcode-text">${p.barcode}</div>
          </div>
        `);
      }
      return labelsArr.join("");
    });

    win.document.write(`<!DOCTYPE html>
<html><head>
<title>Etiquetas</title>
<style>
  @page { margin: 5mm; }
  body { margin: 0; padding: 5mm; font-family: Arial, sans-serif; }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2mm;
  }
  .label {
    border: 1px solid #ccc;
    border-radius: 3px;
    padding: 3mm;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .label-store { font-size: 8px; color: #666; font-weight: bold; }
  .label-name { font-size: 11px; font-weight: bold; margin: 2px 0; }
  .label-price { font-size: 14px; font-weight: bold; color: #1a1a1a; }
  .label-wholesale { font-size: 9px; color: #059669; font-weight: bold; margin-top: 1px; }
  .label-barcode-text { font-size: 8px; font-family: monospace; color: #666; margin-top: 1px; }
  svg { max-width: 100%; height: auto; }
  @media print { .no-print { display: none; } }
</style>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
</head><body>
<div class="no-print" style="margin-bottom:10px; text-align:center;">
  <button onclick="window.print()" style="padding:10px 30px; font-size:16px; cursor:pointer;">IMPRIMIR ETIQUETAS</button>
  <button onclick="window.close()" style="padding:10px 30px; font-size:16px; cursor:pointer; margin-left:10px;">CERRAR</button>
</div>
<div class="grid">${labels.join("")}</div>
<script>
  // Generar todos los barcodes
  document.querySelectorAll('[id^="print-barcode-"]').forEach(function(svg) {
    var id = svg.id.replace('print-barcode-', '');
    var barcodeText = svg.nextElementSibling ? svg.nextElementSibling.textContent : '';
    try {
      JsBarcode(svg, barcodeText, { format: "CODE128", width: 1.5, height: 40, displayValue: false, margin: 2 });
    } catch(e) {}
  });
<\/script>
</body></html>`);
    win.document.close();
  };

  const totalLabels = Array.from(selectedProducts).reduce((s, id) => s + (quantityMap[id] || 1), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Imprimir Etiquetas de Codigo de Barras</span>
            {selectedProducts.size > 0 && (
              <Badge variant="default">{selectedProducts.size} productos / {totalLabels} etiquetas</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filtros */}
          <div className="flex gap-2">
            <Input placeholder="Buscar producto o codigo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1" />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border rounded px-2 text-sm bg-background">
              <option value="all">Todas las categorias</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedProducts.size === filtered.length ? "Deseleccionar" : "Seleccionar"}
            </Button>
          </div>

          {/* Lista de productos con barcode */}
          <div className="max-h-[400px] overflow-y-auto border rounded">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {products.filter(p => p.barcode).length === 0
                  ? "Ningun producto tiene codigo de barras asignado"
                  : "No se encontraron productos con los filtros aplicados"}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-8"></th>
                    <th className="p-2 text-left">Producto</th>
                    <th className="p-2 text-left">Codigo</th>
                    <th className="p-2 text-right">Precio</th>
                    <th className="p-2 text-right">Mayor</th>
                    <th className="p-2 text-center">Cant. Etiquetas</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className={`border-b hover:bg-muted/30 cursor-pointer ${selectedProducts.has(p.id) ? "bg-primary/5" : ""}`}
                      onClick={() => toggleProduct(p.id)}>
                      <td className="p-2">
                        <input type="checkbox" checked={selectedProducts.has(p.id)} onChange={() => {}} className="cursor-pointer" />
                      </td>
                      <td className="p-2">
                        <span className="font-medium">{p.name}</span>
                        {p.category && <span className="text-muted-foreground ml-1">({p.category.name})</span>}
                      </td>
                      <td className="p-2 font-mono">{p.barcode}</td>
                      <td className="p-2 text-right font-bold">${p.price.toFixed(2)}</td>
                      <td className="p-2 text-right text-emerald-600">{p.wholesalePrice > 0 ? `$${p.wholesalePrice.toFixed(2)}` : "-"}</td>
                      <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                        {selectedProducts.has(p.id) && (
                          <div className="flex items-center justify-center gap-1">
                            <button className="w-5 h-5 rounded bg-muted hover:bg-muted/80 text-xs font-bold" onClick={() => setQty(p.id, (quantityMap[p.id] || 1) - 1)}>-</button>
                            <input type="number" min="1" value={quantityMap[p.id] || 1}
                              onChange={e => setQty(p.id, parseInt(e.target.value) || 1)}
                              className="w-10 text-center border rounded text-xs py-0.5" />
                            <button className="w-5 h-5 rounded bg-muted hover:bg-muted/80 text-xs font-bold" onClick={() => setQty(p.id, (quantityMap[p.id] || 1) + 1)}>+</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Separator />

          {/* Acciones */}
          <div className="flex gap-2">
            <Button onClick={() => { setLabelMode("retail"); handlePrint(); }} disabled={selectedProducts.size === 0} className="flex-1">
              Etiquetas Retail ({totalLabels})
            </Button>
            <Button onClick={() => { setLabelMode("wholesale"); handlePrint(); }} disabled={selectedProducts.size === 0 || !products.filter(p => selectedProducts.has(p.id) && p.wholesalePrice > 0).length} variant="outline" className="flex-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50">
              Etiquetas Mayorista ({products.filter(p => selectedProducts.has(p.id) && p.wholesalePrice > 0).reduce((sum, p) => sum + (quantityMap[p.id] || 1), 0)})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== PREVIEW MODAL ===== */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">Vista Previa de Etiquetas</h3>
              <div className="flex gap-2">
                <Button size="sm" onClick={printLabels}>Imprimir</Button>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>Cerrar</Button>
              </div>
            </div>
            <div ref={printRef} className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {products.filter(p => {
                  if (!selectedProducts.has(p.id)) return false;
                  if (labelMode === "wholesale" && (!p.wholesalePrice || p.wholesalePrice <= 0)) return false;
                  return true;
                }).flatMap(p => {
                  const qty = quantityMap[p.id] || 1;
                  return Array.from({ length: qty }, (_, i) => (
                    <div key={`${p.id}-${i}`} className="border rounded p-2 text-center bg-white" style={{ pageBreakInside: "avoid" }}>
                      <p className="text-[8px] text-gray-500 font-bold">{storeName}</p>
                      <p className="text-[11px] font-bold truncate">{p.name}</p>
                      <p className="text-sm font-black">$ {labelMode === "wholesale" ? p.wholesalePrice.toFixed(2) : p.price.toFixed(2)}</p>
                      {labelMode === "wholesale" && <p className="text-[9px] text-emerald-600 font-bold">x{p.minWholesaleQty || ""}+ uds</p>}
                      <canvas id={`barcode-${p.id}-${i}`} className="mx-auto mt-1"></canvas>
                    </div>
                  ));
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}