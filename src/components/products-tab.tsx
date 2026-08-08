"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import BarcodePrint from "@/components/barcode-print";

interface Category { id: string; name: string; icon?: string; color?: string; _count?: { products: number }; }
interface ComboItemProduct { id: string; name: string; barcode: string; price: number; stock: number; icon?: string; }
interface ComboItemData { id: string; comboId: string; productId: string; quantity: number; product?: ComboItemProduct; }
interface Product {
  id: string; name: string; description: string; barcode: string; secondaryBarcode: string;
  price: number; cost: number; marginPercent: number; taxType: string;
  stock: number; minStock: number; wholesalePrice: number; minWholesaleQty: number;
  noStock: boolean; vendePorPeso?: boolean; unidadPeso?: string;
  icon: string; image: string; location: string;
  expirationDate: string | null; lotNumber: string;
  isCombo: boolean; loyaltyPoints: number;
  unitsPerBox: number; boxPrice: number; boxMarginPercent: number;
  categoryId: string | null; category: { name: string } | null; active: boolean;
  comboItems?: ComboItemData[]; comboItemsRef?: ComboItemData[];
}
interface StockAlert { id: string; name: string; barcode: string; stock: number; minStock: number; price: number; cost: number; icon: string; categoryName: string; deficit: number; }
interface StockAlertsData { totalAlerts: number; zeroStockCount: number; lowStockCount: number; zeroStock: StockAlert[]; lowStock: StockAlert[]; }
interface ProductsTabProps { products: Product[]; categories: Category[]; bcvRate: number; currency: string; onRefresh: () => void; maxProducts?: number; licenseType?: string; }

function CatBadge({ categoryName, categories }: { categoryName: string; categories: Category[] }) {
  const cat = categories.find(c => c.name === categoryName);
  if (cat?.color) return <Badge variant="secondary" className="text-[8px] px-1 py-0 flex-shrink-0" style={{ backgroundColor: cat.color + '20', color: cat.color, borderColor: cat.color }}>{cat.icon ? cat.icon + ' ' : ''}{categoryName}</Badge>;
  return <Badge variant="secondary" className="text-[8px] px-1 py-0 flex-shrink-0">{categoryName}</Badge>;
}
function TaxBadge({ taxType }: { taxType: string }) {
  if (taxType === 'exento') return <Badge variant="outline" className="text-[9px] text-gray-500 border-gray-300">EXENTO 0%</Badge>;
  if (taxType === 'reducido') return <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-300">IVA 8%</Badge>;
  return <Badge variant="outline" className="text-[9px] text-orange-600 border-orange-300">IVA 16%</Badge>;
}
function Chevron({ open }: { open: boolean }) {
  return <svg className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>;
}
function MarginBar({ margin }: { margin: number }) {
  const c = margin >= 40 ? 'bg-green-500' : margin >= 20 ? 'bg-yellow-500' : margin > 0 ? 'bg-red-500' : 'bg-gray-300';
  return <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${c}`} style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }} /></div>;
}
function Block({ title, icon, badge, defaultOpen = true, children }: { title: string; icon: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition text-left">
        <div className="flex items-center gap-2"><span>{icon}</span><span className="text-sm font-semibold text-gray-700">{title}</span>{badge && <Badge variant="secondary" className="text-[9px]">{badge}</Badge>}</div>
        <Chevron open={open} />
      </button>
      {open && <div className="px-3 py-3 space-y-3">{children}</div>}
    </div>
  );
}

export default function ProductsTab({ products, categories, bcvRate, currency, onRefresh, maxProducts = 99999, licenseType = "profesional" }: ProductsTabProps) {
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showBarcodePrint, setShowBarcodePrint] = useState(false);
  const emptyForm = { name: "", description: "", barcode: "", secondaryBarcode: "", price: "", cost: "", marginPercent: "", taxType: "general", stock: "", minStock: "5", categoryId: "", icon: "", image: "", wholesalePrice: "", minWholesaleQty: "", noStock: false, vendePorPeso: false, unidadPeso: "kg", location: "", expirationDate: "", lotNumber: "", isCombo: false, loyaltyPoints: "", unitsPerBox: "", boxPrice: "", boxMarginPercent: "" };
  const [formData, setFormData] = useState(emptyForm);
  const [categoryName, setCategoryName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");

  // Combo items
  const [comboItems, setComboItems] = useState<ComboItemData[]>([]);
  const [comboLoading, setComboLoading] = useState(false);
  const [addComboProductId, setAddComboProductId] = useState("");
  const [addComboQty, setAddComboQty] = useState("1");

  // Import/Export
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Bulk price
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [bulkTarget, setBulkTarget] = useState("ALL");
  const [bulkApplyTo, setBulkApplyTo] = useState("sale");
  const [bulkPercentage, setBulkPercentage] = useState("");
  const [bulkPreview, setBulkPreview] = useState<Array<{ name: string; oldPrice: number; newPrice: number; oldCost: number; newCost: number }>>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkApplied, setBulkApplied] = useState(false);
  const getBulkCount = () => bulkTarget === "ALL" ? products.length : products.filter(p => p.categoryId === bulkTarget).length;

  // Stock alerts
  const [stockAlerts, setStockAlerts] = useState<StockAlertsData | null>(null);
  const [showAlerts, setShowAlerts] = useState(true);

  // Barcode scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<any>(null);
  const scannerDivId = useRef("pbar-" + Date.now());

  // Image
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  // Finance summary
  const [showFinance, setShowFinance] = useState(true);

  // ─── EFFECTS ───
  useEffect(() => { (async () => { try { const r = await fetch('/api/products/stock-alerts'); const d = await r.json(); if (r.ok) { setStockAlerts(d); if (d.totalAlerts === 0) setShowAlerts(false); } } catch {} })(); }, []);

  // ─── CALC HELPERS ───
  const calcPrice = (cost: string, margin: string) => { const c = parseFloat(cost) || 0, m = parseFloat(margin) || 0; return c > 0 && m > 0 ? (c / (1 - m / 100)).toFixed(2) : ""; };
  const calcMargin = (price: string, cost: string) => { const p = parseFloat(price) || 0, c = parseFloat(cost) || 0; return p > 0 && c > 0 ? (((p - c) / p) * 100).toFixed(1) : ""; };
  const calcBoxPrice = (cost: string, margin: string, units: string) => { const c = parseFloat(cost) || 0, m = parseFloat(margin) || 0, u = parseInt(units) || 1; return c > 0 && m > 0 && u > 0 ? ((c * u) / (1 - m / 100)).toFixed(2) : ""; };
  const autoPrice = formData.cost && formData.marginPercent ? calcPrice(formData.cost, formData.marginPercent) : "";
  const autoMargin = formData.price && formData.cost ? calcMargin(formData.price, formData.cost) : "";
  const autoBoxPrice = formData.cost && formData.boxMarginPercent && formData.unitsPerBox ? calcBoxPrice(formData.cost, formData.boxMarginPercent, formData.unitsPerBox) : "";

  // ─── FILTERED PRODUCTS ───
  const filtered = products.filter(p => (p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)) && (!filterCategory || p.categoryId === filterCategory));

  // ─── FINANCE TOTALS ───
  const totals = products.reduce((a, p) => { a.val += p.price * p.stock; a.inv += p.cost * p.stock; a.units += p.stock; a.withStock += p.stock > 0 ? 1 : 0; a.noStock += p.stock <= 0 && !p.noStock ? 1 : 0; return a; }, { val: 0, inv: 0, units: 0, withStock: 0, noStock: 0 });
  const gain = totals.val - totals.inv;
  const avgMargin = totals.val > 0 ? (gain / totals.val) * 100 : 0;

  // ─── HANDLERS ───
  const openCreate = () => { if (products.length >= maxProducts) { toast.error(`Limite de ${maxProducts} productos`); return; } setEditingProduct(null); setFormData(emptyForm); setComboItems([]); setShowProductDialog(true); };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({ name: p.name, description: p.description, barcode: p.barcode, secondaryBarcode: p.secondaryBarcode || "", price: p.price.toString(), cost: p.cost.toString(), marginPercent: (p.marginPercent || 0).toString(), taxType: p.taxType || "general", stock: p.stock.toString(), minStock: (p.minStock || 5).toString(), categoryId: p.categoryId || "", icon: p.icon || "", image: p.image || "", wholesalePrice: (p.wholesalePrice || 0).toString(), minWholesaleQty: (p.minWholesaleQty || 0).toString(), noStock: p.noStock || false, vendePorPeso: p.vendePorPeso || false, unidadPeso: p.unidadPeso || "kg", location: p.location || "", expirationDate: p.expirationDate ? p.expirationDate.split("T")[0] : "", lotNumber: p.lotNumber || "", isCombo: p.isCombo || false, loyaltyPoints: (p.loyaltyPoints || 0).toString(), unitsPerBox: (p.unitsPerBox || 0).toString(), boxPrice: (p.boxPrice || 0).toString(), boxMarginPercent: (p.boxMarginPercent || 0).toString() });
    setShowProductDialog(true);
    if (p.isCombo && p.id) { (async () => { try { const r = await fetch(`/api/products/combo-items?comboId=${p.id}`); if (r.ok) setComboItems(await r.json()); } catch { setComboItems([]); } })(); } else setComboItems([]);
  };

  const saveProduct = async () => {
    if (!formData.name || !formData.price) { toast.error("Nombre y precio requeridos"); return; }
    try {
      const res = await fetch("/api/products", { method: editingProduct ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingProduct ? { id: editingProduct.id, ...formData } : formData) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success(editingProduct ? "Producto actualizado" : "Producto creado");
      setShowProductDialog(false); onRefresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteProduct = async (id: string) => { if (!confirm("Desactivar producto?")) return; try { await fetch(`/api/products?id=${id}`, { method: "DELETE" }); toast.success("Desactivado"); onRefresh(); } catch { toast.error("Error"); } };

  const createCategory = async () => {
    if (!categoryName.trim()) return;
    try { const r = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: categoryName.trim(), icon: newCatIcon, color: newCatColor }) }); if (!r.ok) throw new Error((await r.json()).error); toast.success("Categoria creada"); setCategoryName(""); setShowCategoryDialog(false); onRefresh(); } catch (e: any) { toast.error(e.message); }
  };
  const deleteCategory = async (id: string) => { if (!confirm("Eliminar categoria?")) return; try { await fetch(`/api/categories?id=${id}`, { method: "DELETE" }); toast.success("Eliminada"); onRefresh(); } catch {} };

  // Scanner
  const openScanner = async () => {
    setShowScanner(true); setScannerLoading(true); setScannerError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode(scannerDivId.current);
      scannerRef.current = qr;
      await qr.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } }, (txt: string) => { stopScanner(); setFormData(p => ({ ...p, barcode: txt })); toast.success("Escaneado: " + txt); }, () => {});
      setScannerLoading(false);
    } catch (e: any) {
      setScannerLoading(false);
      const m = (e?.message || "").toLowerCase();
      setScannerError(m.includes("permission") ? "Permiso denegado. Active la camara en el navegador." : m.includes("notfound") ? "No se encontro camara." : "Error al iniciar escaner.");
    }
  };
  const stopScanner = async () => { try { if (scannerRef.current) { if (scannerRef.current.getState() === 2) await scannerRef.current.stop(); scannerRef.current.clear(); scannerRef.current = null; } } catch {} setShowScanner(false); setScannerError(""); };

  // Image
  const uploadImage = async (file: File) => { setUploading(true); try { const fd = new FormData(); fd.append("image", file); const r = await fetch("/api/products/upload", { method: "POST", body: fd }); const d = await r.json(); if (d.imageUrl) { setFormData(p => ({ ...p, image: d.imageUrl })); toast.success("Imagen subida"); } } catch { toast.error("Error al subir"); } finally { setUploading(false); } };

  // Combo items
  const addComboItem = async () => {
    if (!editingProduct?.id || !addComboProductId) return;
    setComboLoading(true);
    try {
      const r = await fetch("/api/products/combo-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comboId: editingProduct.id, productId: addComboProductId, quantity: parseInt(addComboQty) || 1 }) });
      if (r.ok) { const item = await r.json(); setComboItems(prev => [...prev, item]); setAddComboProductId(""); setAddComboQty("1"); toast.success("Agregado al combo"); } else { const err = await r.json(); toast.error(err.error); }
    } catch { toast.error("Error"); } finally { setComboLoading(false); }
  };
  const removeComboItem = async (id: string) => { setComboLoading(true); try { await fetch(`/api/products/combo-items?id=${id}`, { method: "DELETE" }); setComboItems(prev => prev.filter(i => i.id !== id)); toast.success("Removido"); } catch {} setComboLoading(false); };

  // Bulk
  const handleBulkPreview = () => { const pct = parseFloat(bulkPercentage); if (!pct) { toast.error("Porcentaje invalido"); return; } setBulkLoading(true); const tp = bulkTarget === "ALL" ? products : products.filter(p => p.categoryId === bulkTarget); const as = bulkApplyTo === "sale" || bulkApplyTo === "both"; const ac = bulkApplyTo === "cost" || bulkApplyTo === "both"; setBulkPreview(tp.map(p => { const f = 1 + pct / 100; return { name: p.name, oldPrice: p.price, newPrice: as && p.price > 0 ? +(p.price * f).toFixed(4) : p.price, oldCost: p.cost, newCost: ac && p.cost > 0 ? +(p.cost * f).toFixed(4) : p.cost }; })); setBulkLoading(false); };
  const handleBulkApply = async () => { const pct = parseFloat(bulkPercentage); if (!pct) return; if (!confirm(`Aplicar ${pct > 0 ? '+' : ''}${pct}% a ${getBulkCount()} productos?`)) return; setBulkLoading(true); try { const r = await fetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bulk-price', categoryId: bulkTarget, percentage: pct, applyTo: bulkApplyTo }) }); const d = await r.json(); if (!r.ok) { toast.error(d.error); setBulkLoading(false); return; } toast.success(`${d.updatedCount} productos actualizados`); setBulkPreview(d.preview || []); setBulkApplied(true); onRefresh(); } catch { toast.error("Error"); } setBulkLoading(false); };

  // Import/Export
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setImporting(true); try { const fd = new FormData(); fd.append('file', f); const r = await fetch('/api/products/import', { method: 'POST', body: fd }); const d = await r.json(); if (!r.ok) toast.error(d.error); else { const p: string[] = []; if (d.created > 0) p.push(`${d.created} creados`); if (d.updated > 0) p.push(`${d.updated} actualizados`); toast.success(p.join(', ')); onRefresh(); } } catch { toast.error("Error"); } setImporting(false); if (importFileRef.current) importFileRef.current.value = ''; };
  const handleExport = async () => { setExporting(true); try { const r = await fetch('/api/products/export'); if (!r.ok) { toast.error("Error"); setExporting(false); return; } const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); toast.success("Exportado"); } catch { toast.error("Error"); } setExporting(false); };

  // Available products for combo (exclude self)
  const comboAvailable = products.filter(p => p.id !== editingProduct?.id && p.active);

  return (
    <div className="space-y-3">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={filterCategory} onChange={e => setFilterCategory((e.target as any).value)}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowCategoryDialog(true)} className="text-xs">Categorias</Button>
          <Button variant="outline" size="sm" onClick={() => { setBulkPreview([]); setBulkApplied(false); setBulkPercentage(""); setShowBulkPrice(true); }} className="text-xs text-orange-600">Ajuste Precios</Button>
          <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()} disabled={importing} className="text-xs">Importar</Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="text-xs">Exportar</Button>
          <Button variant="outline" size="sm" onClick={() => setShowBarcodePrint(true)} className="text-xs">Etiquetas</Button>
          <Button size="sm" onClick={openCreate} className="text-xs">+ Producto</Button>
          <input type="file" ref={importFileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* FINANCE SUMMARY */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">Resumen del Inventario</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowFinance(!showFinance)}>{showFinance ? 'Ocultar' : 'Mostrar'}</Button>
          </div>
          {showFinance && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded border p-2 text-center">
                <p className="text-[9px] text-muted-foreground uppercase">Valor Inventario</p>
                <p className="text-sm font-bold text-blue-600">{currency} {totals.val.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded border p-2 text-center">
                <p className="text-[9px] text-muted-foreground uppercase">Capital Invertido</p>
                <p className="text-sm font-bold text-orange-600">{currency} {totals.inv.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded border p-2 text-center">
                <p className="text-[9px] text-muted-foreground uppercase">Ganancia Potencial</p>
                <p className={`text-sm font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>{currency} {gain.toFixed(2)}</p>
                <div className="mt-1"><MarginBar margin={avgMargin} /></div>
                <p className="text-[9px] text-muted-foreground">Margen {avgMargin.toFixed(1)}%</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STOCK ALERTS */}
      {stockAlerts && stockAlerts.totalAlerts > 0 && showAlerts && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-orange-700">Alertas ({stockAlerts.totalAlerts})</span>
              <Badge variant="destructive" className="text-[9px]">{stockAlerts.zeroStockCount} sin stock</Badge>
              <Badge className="text-[9px] bg-orange-100 text-orange-700">{stockAlerts.lowStockCount} bajo</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowAlerts(false)}>Ocultar</Button>
          </div>
          {stockAlerts.zeroStock.length > 0 && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-2">
              <p className="text-[10px] font-bold text-red-700 mb-1">SIN STOCK ({stockAlerts.zeroStock.length})</p>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {stockAlerts.zeroStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-[10px] bg-white rounded px-2 py-1 border border-red-100">
                    <div className="flex items-center gap-1"><span dangerouslySetInnerHTML={{ __html: p.icon || '' }} /><span className="truncate">{p.name}</span></div>
                    <span className="text-red-600 font-bold">0 uds</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stockAlerts.lowStock.length > 0 && (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-2">
              <p className="text-[10px] font-bold text-orange-700 mb-1">STOCK BAJO ({stockAlerts.lowStock.length})</p>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {stockAlerts.lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-[10px] bg-white rounded px-2 py-1 border border-orange-100">
                    <div className="flex items-center gap-1"><span dangerouslySetInnerHTML={{ __html: p.icon || '' }} /><span className="truncate">{p.name}</span></div>
                    <div className="flex items-center gap-1"><span className="text-orange-600 font-bold">{p.stock}</span><span className="text-muted-foreground">falta {p.deficit}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS TABLE */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium w-8"></th>
                  <th className="text-left p-2 font-medium">Producto</th>
                  <th className="text-right p-2 font-medium">USD</th>
                  <th className="text-right p-2 font-medium">Bs</th>
                  <th className="text-right p-2 font-medium">Costo</th>
                  <th className="text-right p-2 font-medium">Margen</th>
                  <th className="text-right p-2 font-medium">Stock</th>
                  <th className="text-left p-2 font-medium">IVA</th>
                  <th className="text-center p-2 font-medium w-20">Acc.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => {
                  const mg = product.cost > 0 && product.price > 0 ? ((product.price - product.cost) / product.price * 100) : 0;
                  return (
                    <tr key={product.id} className="border-t hover:bg-muted/30 cursor-pointer" onDoubleClick={() => openEdit(product)}>
                      <td className="p-2">{product.image ? <img src={product.image} alt="" className="w-7 h-7 rounded object-cover" /> : <span className="text-base">{product.icon || ''}</span>}</td>
                      <td className="p-2">
                        <div className="font-medium truncate max-w-[160px]">{product.name}
                          <div className="flex gap-1 mt-0.5">
                            {product.noStock && <Badge variant="secondary" className="text-[7px] px-1 py-0">S/Stock</Badge>}
                            {product.isCombo && <Badge variant="outline" className="text-[7px] px-1 py-0 text-orange-600">KIT</Badge>}
                            {product.unitsPerBox > 0 && <Badge variant="outline" className="text-[7px] px-1 py-0 text-purple-600">x{product.unitsPerBox}</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-right font-bold text-green-600">{product.price.toFixed(2)}</td>
                      <td className="p-2 text-right text-muted-foreground">{(product.price * bcvRate).toFixed(2)}</td>
                      <td className="p-2 text-right">{product.cost.toFixed(2)}</td>
                      <td className="p-2 text-right">{product.cost > 0 ? <span className={`font-medium ${mg >= 30 ? 'text-green-600' : mg >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{mg.toFixed(0)}%</span> : <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-2 text-right"><Badge variant={product.stock > (product.minStock || 5) ? "secondary" : "destructive"} className="text-[10px]">{product.stock}</Badge></td>
                      <td className="p-2"><TaxBadge taxType={product.taxType} /></td>
                      <td className="p-2 text-center"><div className="flex gap-0.5 justify-center"><Button variant="ghost" size="sm" onClick={() => openEdit(product)} className="h-6 text-[10px]">Edit</Button><Button variant="ghost" size="sm" onClick={() => deleteProduct(product.id)} className="h-6 text-[10px] text-destructive">X</Button></div></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={9} className="text-center p-8 text-muted-foreground">No se encontraron productos</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ DIALOG: PRODUCT FORM (WIDE, 6 BLOCKS) ═══ */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-lg">{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">

            {/* BLOCK 1: INFO GENERAL */}
            <Block title="Informacion General" icon="📦" defaultOpen={true}>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2"><Label className="text-xs">Nombre *</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="text-sm" /></div>
                <div><Label className="text-xs">Icono</Label><Input value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} placeholder="🍕" className="text-lg text-center" /></div>
                <div><Label className="text-xs">Categoria</Label><Select value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: (e.target as any).value })}><option value="">Sin cat.</option>{categories.map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}</Select></div>
              </div>
              <div><Label className="text-xs">Descripcion</Label><Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Opcional" className="text-sm" /></div>
            </Block>

            {/* BLOCK 2: SENIAT IVA + PRECIOS + MARGEN AUTO */}
            <Block title="Clasificacion Fiscal SENIAT, Precios y Margen" icon="🏛️" defaultOpen={true}>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Tipo IVA (SENIAT)</Label>
                  <Select value={formData.taxType} onChange={e => setFormData({ ...formData, taxType: (e.target as any).value })}>
                    <option value="general">General (16%)</option>
                    <option value="reducido">Reducido (8%)</option>
                    <option value="exento">Exento (0%)</option>
                  </Select>
                  <p className="text-[8px] text-muted-foreground mt-0.5">Obligatorio para Aclas</p>
                </div>
                <div>
                  <Label className="text-xs">Costo ({currency})</Label>
                  <Input type="number" step="0.01" min="0" value={formData.cost} onChange={e => { const c = e.target.value, nf = { ...formData, cost: c }; if (c && formData.marginPercent) nf.price = calcPrice(c, formData.marginPercent); setFormData(nf); }} placeholder="0.00" className="text-sm font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Margen %</Label>
                  <Input type="number" step="0.1" min="0" max="99" value={formData.marginPercent} onChange={e => { const m = e.target.value, nf = { ...formData, marginPercent: m }; if (formData.cost && m) nf.price = calcPrice(formData.cost, m); setFormData(nf); }} placeholder="35" className="text-sm font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Precio ({currency}) *</Label>
                  <Input type="number" step="0.01" min="0" value={autoPrice || formData.price} onChange={e => { const p = e.target.value, nf = { ...formData, price: p }; if (p && formData.cost) nf.marginPercent = calcMargin(p, formData.cost); setFormData(nf); }} className="text-sm font-mono font-bold text-green-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <div className="flex justify-between text-[9px] text-muted-foreground mb-1"><span>Margen real</span><span className={`font-bold ${parseFloat(autoMargin) >= 30 ? 'text-green-600' : parseFloat(autoMargin) >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{autoMargin}%</span></div>
                  <MarginBar margin={parseFloat(autoMargin) || 0} />
                </div>
                <div className="text-right">
                  {formData.price && bcvRate > 0 && <p className="text-xs text-green-700 font-medium">Bs {(parseFloat(formData.price) * bcvRate).toFixed(2)}</p>}
                  {autoPrice && <p className="text-[9px] text-blue-600">Auto: {currency} {autoPrice} (costo+margen)</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div><Label className="text-[10px]">P. Mayorista ({currency})</Label><Input type="number" step="0.01" min="0" value={formData.wholesalePrice} onChange={e => setFormData({ ...formData, wholesalePrice: e.target.value })} placeholder="0=off" className="text-sm" /></div>
                <div><Label className="text-[10px]">Cant. Min. Mayorista</Label><Input type="number" min="0" value={formData.minWholesaleQty} onChange={e => setFormData({ ...formData, minWholesaleQty: e.target.value })} className="text-sm" /></div>
                <div><Label className="text-[10px]">Stock</Label><Input type="number" min="0" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} className="text-sm" /></div>
              </div>
            </Block>

            {/* BLOCK 3: MULTI-EMPAQUE */}
            <Block title="Venta por Bulto / Mayoristas" icon="📋" badge={formData.unitsPerBox && formData.unitsPerBox !== "0" ? "ACTIVO" : undefined} defaultOpen={false}>
              <div className="grid grid-cols-4 gap-2">
                <div><Label className="text-[10px]">Unidades por Bulto</Label><Input type="number" min="0" value={formData.unitsPerBox} onChange={e => setFormData({ ...formData, unitsPerBox: e.target.value })} placeholder="Ej: 20" className="text-sm" /><p className="text-[8px] text-muted-foreground">Paca de N unidades</p></div>
                <div><Label className="text-[10px]">Margen Bulto %</Label><Input type="number" step="0.1" min="0" max="99" value={formData.boxMarginPercent} onChange={e => { const m = e.target.value, nf = { ...formData, boxMarginPercent: m }; if (formData.cost && m && formData.unitsPerBox) nf.boxPrice = calcBoxPrice(formData.cost, m, formData.unitsPerBox); setFormData(nf); }} placeholder="25" className="text-sm" /></div>
                <div><Label className="text-[10px]">Precio Bulto ({currency})</Label><Input type="number" step="0.01" min="0" value={autoBoxPrice || formData.boxPrice} onChange={e => setFormData({ ...formData, boxPrice: e.target.value })} className="text-sm font-bold text-emerald-600" />{autoBoxPrice && <p className="text-[8px] text-blue-600">Auto: (costo x {formData.unitsPerBox}) + margen</p>}</div>
                <div><Label className="text-[10px]">Stock Minimo (alerta)</Label><Input type="number" min="0" value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: e.target.value })} placeholder="5" className="text-sm" /></div>
              </div>
            </Block>

            {/* BLOCK 4: FOTO + CODIGOS */}
            <Block title="Foto y Codigos de Barras" icon="📸" defaultOpen={false}>
              <div className="flex items-start gap-3">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                  {formData.image ? <img src={formData.image} alt="Producto" className="w-full h-full object-cover" /> : <span className="text-2xl text-gray-300">📷</span>}
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex gap-2">
                    <input type="file" ref={camRef} accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" className="text-[10px]" onClick={() => camRef.current?.click()} disabled={uploading}>{uploading ? "..." : "📷 Tomar Foto"}</Button>
                    <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" className="text-[10px]" onClick={() => fileRef.current?.click()} disabled={uploading}>📁 Galeria</Button>
                    {formData.image && <Button type="button" variant="outline" size="sm" className="text-[10px] text-red-500" onClick={() => setFormData(p => ({ ...p, image: "" }))}>X</Button>}
                  </div>
                  <p className="text-[9px] text-muted-foreground">Use la camara del celular. Buena iluminacion recomendada.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-[10px]">Codigo Barras Principal</Label>
                  <div className="relative">
                    <Input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Escanee o escriba" className="text-xs font-mono pr-14" />
                    <Button type="button" size="sm" variant="outline" className="absolute right-0.5 top-0.5 h-7 text-[10px] px-2" onClick={openScanner}>📱</Button>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Codigo Secundario</Label>
                  <Input value={formData.secondaryBarcode} onChange={e => setFormData({ ...formData, secondaryBarcode: e.target.value })} placeholder="Codigo alternativo" className="text-xs font-mono" />
                  <p className="text-[8px] text-muted-foreground">Para productos importados con codigo distinto</p>
                </div>
              </div>
            </Block>

            {/* BLOCK 5: TRAZABILIDAD */}
            <Block title="Trazabilidad y Ubicacion" icon="🔍" defaultOpen={false}>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-[10px]">Vencimiento</Label><Input type="date" value={formData.expirationDate} onChange={e => setFormData({ ...formData, expirationDate: e.target.value })} className="text-xs" /><p className="text-[8px] text-muted-foreground">Alimentos, medicinas</p></div>
                <div><Label className="text-[10px]">Lote</Label><Input value={formData.lotNumber} onChange={e => setFormData({ ...formData, lotNumber: e.target.value })} placeholder="Lote fabrica" className="text-xs font-mono" /><p className="text-[8px] text-muted-foreground">Rastrear proveedor</p></div>
                <div><Label className="text-[10px]">Ubicacion en Tienda</Label><Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Pasillo 4, Anaquel C" className="text-xs" /></div>
              </div>
            </Block>

            {/* BLOCK 6: ESTRATEGIA - COMBOS + FIDELIDAD */}
            <Block title="Estrategia Comercial, Combos y Fidelidad" icon="🎯" defaultOpen={false}>
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isCombo} onChange={e => setFormData({ ...formData, isCombo: e.target.checked })} className="h-4 w-4 rounded" /><span className="text-sm font-medium">Es Combo / Kit</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.noStock} onChange={e => setFormData({ ...formData, noStock: e.target.checked })} className="h-4 w-4 rounded" /><span className="text-sm">Sin control stock</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.vendePorPeso} onChange={e => setFormData({ ...formData, vendePorPeso: e.target.checked })} className="h-4 w-4 rounded" /><span className="text-sm">Vender por peso</span></label>
              </div>
              {formData.vendePorPeso && <div className="flex gap-2 mb-2">{["kg", "g", "lb"].map(u => <button key={u} type="button" onClick={() => setFormData({ ...formData, unidadPeso: u })} className={`px-3 py-1 rounded border text-xs ${formData.unidadPeso === u ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{u}</button>)}</div>}
              <div className="w-48">
                <Label className="text-[10px]">Puntos Fidelidad</Label>
                <Input type="number" min="0" value={formData.loyaltyPoints} onChange={e => setFormData({ ...formData, loyaltyPoints: e.target.value })} placeholder="0" className="text-sm" />
                <p className="text-[8px] text-muted-foreground">Puntos al cliente por comprar este producto</p>
              </div>
              {formData.isCombo && editingProduct && (
                <div className="mt-3 border rounded-lg overflow-hidden">
                  <div className="bg-orange-50 px-3 py-2"><span className="text-sm font-bold text-orange-700">Productos del Combo</span> <Badge variant="secondary" className="text-[9px]">{comboItems.length} items</Badge></div>
                  <div className="p-2 space-y-2">
                    <div className="flex gap-2">
                      <Select value={addComboProductId} onChange={e => setAddComboProductId((e.target as any).value)} className="flex-1">
                        <option value="">Seleccionar...</option>
                        {comboAvailable.map(p => <option key={p.id} value={p.id}>{p.icon ? p.icon + ' ' : ''}{p.name} (${p.price.toFixed(2)}) - Stock: {p.stock}</option>)}
                      </Select>
                      <Input type="number" min="1" value={addComboQty} onChange={e => setAddComboQty(e.target.value)} className="w-16 text-xs" />
                      <Button size="sm" onClick={addComboItem} disabled={comboLoading || !addComboProductId} className="text-xs">+</Button>
                    </div>
                    {comboItems.length > 0 ? (
                      <div className="border rounded max-h-36 overflow-y-auto">
                        <table className="w-full text-[10px]">
                          <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left p-1">Producto</th><th className="text-right p-1">P.Unit</th><th className="text-center p-1">Cant</th><th className="text-right p-1">Subtotal</th><th className="text-center p-1">Stock</th><th className="p-1"></th></tr></thead>
                          <tbody>
                            {comboItems.map(item => (
                              <tr key={item.id} className="border-t">
                                <td className="p-1">{item.product?.icon} {item.product?.name}</td>
                                <td className="p-1 text-right">${(item.product?.price || 0).toFixed(2)}</td>
                                <td className="p-1 text-center font-bold">{item.quantity}</td>
                                <td className="p-1 text-right font-bold text-green-600">${((item.product?.price || 0) * item.quantity).toFixed(2)}</td>
                                <td className="p-1 text-center"><Badge variant={item.product && item.product.stock >= item.quantity ? "secondary" : "destructive"} className="text-[8px]">{item.product?.stock || 0}</Badge></td>
                                <td className="p-1 text-center"><Button variant="ghost" size="sm" className="h-5 text-[9px] text-red-500" onClick={() => removeComboItem(item.id)}>X</Button></td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-orange-300 bg-orange-50 font-bold">
                              <td className="p-1" colSpan={3}>TOTAL COMBO</td>
                              <td className="p-1 text-right text-orange-700">${comboItems.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0).toFixed(2)}</td>
                              <td className="p-1 text-right text-orange-700" colSpan={2}>Bs {(comboItems.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0) * bcvRate).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-[10px] text-muted-foreground text-center py-3">Sin productos. Agregue arriba.</p>}
                    <p className="text-[9px] text-muted-foreground">Al vender, se descuenta stock de cada ingrediente automaticamente.</p>
                  </div>
                </div>
              )}
              {formData.isCombo && !editingProduct && <p className="text-[10px] text-orange-600 bg-orange-50 rounded p-2 mt-2">Guarde el producto primero para agregar ingredientes al combo.</p>}
            </Block>

            {/* SAVE */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowProductDialog(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveProduct}>{editingProduct ? "Actualizar" : "Crear"} Producto</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SCANNER DIALOG */}
      <Dialog open={showScanner} onOpenChange={o => { if (!o) stopScanner(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-center">Escaneando Codigo...</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {scannerLoading && <div className="flex flex-col items-center py-12 gap-3"><div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div><p className="text-sm text-muted-foreground">Iniciando camara...</p></div>}
            {scannerError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><p className="font-semibold">Error</p><p>{scannerError}</p><div className="flex gap-2 mt-2"><Button variant="outline" className="flex-1 text-xs" onClick={stopScanner}>Cerrar</Button><Button className="flex-1 text-xs" onClick={openScanner}>Reintentar</Button></div></div>}
            {!scannerLoading && !scannerError && <><div id={scannerDivId.current} className="rounded-lg overflow-hidden" style={{ minHeight: "250px" }} /><p className="text-[10px] text-center text-muted-foreground">Apunte la camara al codigo.</p></>}
            <Input placeholder="O escriba manualmente..." value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} className="font-mono text-center" />
            <Button variant="outline" className="w-full text-xs" onClick={stopScanner}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CATEGORIES DIALOG */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Categorias</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Nueva categoria" onKeyDown={e => e.key === "Enter" && createCategory()} className="flex-1" />
              <Input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} placeholder="Icono" className="w-14 text-center" />
              <Input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-10 h-9 p-1" />
              <Button onClick={createCategory}>+</Button>
            </div>
            <Separator />
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {categories.map(c => <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted"><span className="text-sm">{c.icon ? c.icon + ' ' : ''}{c.name} <span className="text-muted-foreground text-xs">({c._count?.products || 0})</span></span><Button variant="ghost" size="sm" onClick={() => deleteCategory(c.id)} className="text-destructive text-xs h-7">X</Button></div>)}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* BARCODE PRINT */}
      {showBarcodePrint && <BarcodePrint products={products} bcvRate={bcvRate} currency={currency} />}

      {/* BULK PRICE DIALOG */}
      <Dialog open={showBulkPrice} onOpenChange={o => { if (!o) setShowBulkPrice(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ajuste Masivo de Precios</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Aplicar a</Label><Select value={bulkTarget} onChange={e => { setBulkTarget((e.target as any).value); setBulkPreview([]); setBulkApplied(false); }}><option value="ALL">Todo ({products.length})</option>{categories.filter(c => products.some(p => p.categoryId === c.id)).map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name} ({products.filter(p => p.categoryId === c.id).length})</option>)}</Select></div>
            <div><Label>Tipo</Label><Select value={bulkApplyTo} onChange={e => { setBulkApplyTo((e.target as any).value); setBulkPreview([]); setBulkApplied(false); }}><option value="sale">Precio VENTA</option><option value="cost">Precio COMPRA</option><option value="both">Ambos</option></Select></div>
            <div><Label>Porcentaje</Label><div className="flex items-center gap-2"><Input type="number" value={bulkPercentage} onChange={e => { setBulkPercentage(e.target.value); setBulkPreview([]); setBulkApplied(false); }} placeholder="20" className="w-32" /><span className="text-sm">%</span></div></div>
            <div className="bg-muted/50 rounded-lg p-2 text-sm">{getBulkCount()} productos afectados</div>
            {!bulkApplied && <Button onClick={handleBulkPreview} disabled={bulkLoading || !bulkPercentage || parseFloat(bulkPercentage) === 0} className="bg-blue-600">Vista Previa</Button>}
            {bulkPreview.length > 0 && <>
              <Separator />
              <div className="border rounded max-h-60 overflow-y-auto"><table className="w-full text-xs"><thead className="bg-muted/70 sticky top-0"><tr><th className="text-left p-2">Producto</th><th className="text-right p-2">Antes</th><th className="text-right p-2">Nuevo</th><th className="text-right p-2">Dif.</th></tr></thead><tbody>{bulkPreview.map((item, i) => { const d = item.newPrice - item.oldPrice; return <tr key={i} className="border-t"><td className="p-2 truncate max-w-[150px]">{item.name}</td><td className="p-2 text-right">${item.oldPrice.toFixed(2)}</td><td className="p-2 text-right font-bold">${item.newPrice.toFixed(2)}</td><td className={`p-2 text-right ${d > 0 ? 'text-green-600' : 'text-red-600'}`}>{d > 0 ? '+' : ''}{d.toFixed(2)}</td></tr>; })}</tbody></table></div>
              {!bulkApplied && <Button onClick={handleBulkApply} disabled={bulkLoading} className="bg-orange-600 text-white font-bold w-full">APLICAR {parseFloat(bulkPercentage) > 0 ? '+' : ''}{bulkPercentage}%</Button>}
            </>}
            {bulkApplied && <Button variant="outline" onClick={() => setShowBulkPrice(false)}>Cerrar</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
