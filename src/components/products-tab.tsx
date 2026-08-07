"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import BarcodePrint from "@/components/barcode-print";

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  _count?: { products: number };
}

interface Product {
  id: string;
  name: string;
  description: string;
  barcode: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  noStock: boolean;
  vendePorPeso?: boolean;
  unidadPeso?: string;
  icon: string;
  categoryId: string | null;
  category: { name: string } | null;
  active: boolean;
}

interface StockAlert {
  id: string;
  name: string;
  barcode: string;
  stock: number;
  minStock: number;
  price: number;
  cost: number;
  icon: string;
  categoryName: string;
  deficit: number;
}

interface StockAlertsData {
  totalAlerts: number;
  zeroStockCount: number;
  lowStockCount: number;
  zeroStock: StockAlert[];
  lowStock: StockAlert[];
}

interface ProductsTabProps {
  products: Product[];
  categories: Category[];
  bcvRate: number;
  currency: string;
  onRefresh: () => void;
  maxProducts?: number;
  licenseType?: string;
}

function CatBadge({ categoryName, categories }: { categoryName: string; categories: Category[] }) {
  const cat = categories.find(c => c.name === categoryName);
  if (cat && cat.color) {
    return <Badge variant="secondary" className="text-[8px] px-1 py-0 flex-shrink-0" style={{ backgroundColor: cat.color + '20', color: cat.color, borderColor: cat.color }}>{cat.icon ? cat.icon + ' ' : ''}{categoryName}</Badge>;
  }
  return <Badge variant="secondary" className="text-[8px] px-1 py-0 flex-shrink-0">{categoryName}</Badge>;
}

export default function ProductsTab({ products, categories, bcvRate, currency, onRefresh, maxProducts = 99999, licenseType = "profesional" }: ProductsTabProps) {
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showBarcodePrint, setShowBarcodePrint] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    barcode: "",
    price: "",
    cost: "",
    stock: "",
    categoryId: "",
    icon: "",
    wholesalePrice: "",
    minWholesaleQty: "",
    noStock: false,
    vendePorPeso: false,
    unidadPeso: "kg",
  });
  const [categoryName, setCategoryName] = useState("");
    const [newCatIcon, setNewCatIcon] = useState("");
    const [newCatColor, setNewCatColor] = useState("#6366f1");

  // ===== EXCEL IMPORT/EXPORT =====
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ===== AJUSTE MASIVO DE PRECIOS =====
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [bulkTarget, setBulkTarget] = useState("ALL");
  const [bulkApplyTo, setBulkApplyTo] = useState("sale");
  const [bulkPercentage, setBulkPercentage] = useState("");
  const [bulkPreview, setBulkPreview] = useState<Array<{ name: string; oldPrice: number; newPrice: number; oldCost: number; newCost: number }>>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkApplied, setBulkApplied] = useState(false);

  const getBulkAffectedCount = () => {
    if (bulkTarget === "ALL") return products.length;
    return products.filter(p => p.categoryId === bulkTarget).length;
  };

  const handleBulkPreview = () => {
    const pct = parseFloat(bulkPercentage);
    if (isNaN(pct) || pct === 0) {
      toast.error("Ingrese un porcentaje valido (ej: 20 para aumentar 20%)");
      return;
    }
    setBulkLoading(true);
    setBulkApplied(false);
    try {
      const targetProducts = bulkTarget === "ALL"
        ? products
        : products.filter(p => p.categoryId === bulkTarget);
      const applySale = bulkApplyTo === "sale" || bulkApplyTo === "both";
      const applyCost = bulkApplyTo === "cost" || bulkApplyTo === "both";
      const preview = targetProducts.map(p => {
        const factor = 1 + pct / 100;
        return {
          name: p.name,
          oldPrice: p.price,
          newPrice: applySale && p.price > 0 ? Math.round(p.price * factor * 10000) / 10000 : p.price,
          oldCost: p.cost,
          newCost: applyCost && p.cost > 0 ? Math.round(p.cost * factor * 10000) / 10000 : p.cost,
        };
      });
      setBulkPreview(preview);
    } catch {
      toast.error("Error al generar vista previa");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkApply = async () => {
    const pct = parseFloat(bulkPercentage);
    if (isNaN(pct) || pct === 0) {
      toast.error("Ingrese un porcentaje valido");
      return;
    }
    if (!confirm(`¿Aplicar ${pct > 0 ? '+' : ''}${pct}% a ${getBulkAffectedCount()} productos?\n\nEsta accion modificara los precios directamente.`)) {
      return;
    }
    setBulkLoading(true);
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-price',
          categoryId: bulkTarget,
          percentage: pct,
          applyTo: bulkApplyTo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al aplicar ajuste');
        setBulkLoading(false);
        return;
      }
      toast.success(`Ajuste aplicado: ${data.updatedCount} productos actualizados con ${pct > 0 ? '+' : ''}${pct}%`, { duration: 5000 });
      setBulkPreview(data.preview || []);
      setBulkApplied(true);
      onRefresh();
    } catch {
      toast.error("Error de conexion al aplicar ajuste");
    } finally {
      setBulkLoading(false);
    }
  };

  // ===== STOCK ALERTS =====
  const [stockAlerts, setStockAlerts] = useState<StockAlertsData | null>(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(false);

  useEffect(() => {
    loadStockAlerts();
  }, []);

  const loadStockAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await fetch('/api/products/stock-alerts');
      const data = await res.json();
      if (res.ok && !data.error) {
        setStockAlerts(data);
        // Auto-hide after seeing if no alerts
        if (data.totalAlerts === 0) setShowAlerts(false);
      }
    } catch { /* silent */ }
    setAlertsLoading(false);
  };

  // Expose loadStockAlerts for parent refresh
  useEffect(() => {
    (window as any).__loadStockAlerts = loadStockAlerts;
    return () => { delete (window as any).__loadStockAlerts; };
  }, []);

  // ===== BARCODE SCANNER FOR PRODUCT FORM =====
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeScannerLoading, setBarcodeScannerLoading] = useState(false);
  const [barcodeScannerError, setBarcodeScannerError] = useState("");
  const barcodeScannerRef = useRef<any>(null);
  const barcodeScannerDivId = useRef<string>("product-barcode-scanner-" + Date.now());

  const openBarcodeScanner = async () => {
    setShowBarcodeScanner(true);
    setBarcodeScannerLoading(true);
    setBarcodeScannerError("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scannerId = barcodeScannerDivId.current;
      const html5QrCode = new Html5Qrcode(scannerId);
      barcodeScannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 4 / 3 },
        (decodedText: string) => {
          stopBarcodeScanner();
          setFormData(prev => ({ ...prev, barcode: decodedText }));
          toast.success("Codigo escaneado: " + decodedText);
        },
        () => { /* frame sin codigo, normal */ }
      );
      setBarcodeScannerLoading(false);
    } catch (err: any) {
      setBarcodeScannerLoading(false);
      const errMsg = (err?.message || "").toLowerCase();
      if (errMsg.includes("permission") || errMsg.includes("notallowed")) {
        setBarcodeScannerError("Permiso de camara denegado. Permita el acceso en la configuracion del navegador y recargue la pagina.");
      } else if (errMsg.includes("notfound")) {
        setBarcodeScannerError("No se encontro ninguna camara. Verifique que este conectada.");
      } else {
        setBarcodeScannerError("Error al iniciar el escaner. Verifique los permisos de la camara.");
      }
    }
  };

  const stopBarcodeScanner = async () => {
    try {
      if (barcodeScannerRef.current) {
        const state = barcodeScannerRef.current.getState();
        if (state === 2) await barcodeScannerRef.current.stop();
        barcodeScannerRef.current.clear();
        barcodeScannerRef.current = null;
      }
    } catch {}
    setShowBarcodeScanner(false);
    setBarcodeScannerError("");
  };

  const filteredProducts = products.filter(
    (p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
      const matchCat = !filterCategory || p.categoryId === filterCategory;
      return matchSearch && matchCat;
    }
  );

  // ===== RESUMEN FINANCIERO DEL INVENTARIO =====
  const [showFinance, setShowFinance] = useState(true);
  const totals = products.reduce(
    (acc, p) => {
      const valor = p.price * p.stock;
      const invertido = p.cost * p.stock;
      acc.valorInventario += valor;
      acc.capitalInvertido += invertido;
      acc.totalUnidades += p.stock;
      acc.productosConStock += p.stock > 0 ? 1 : 0;
      acc.productosSinStock += p.stock <= 0 && !p.noStock ? 1 : 0;
      return acc;
    },
    { valorInventario: 0, capitalInvertido: 0, totalUnidades: 0, productosConStock: 0, productosSinStock: 0 }
  );
  const gananciaPotencial = totals.valorInventario - totals.capitalInvertido;
  const margenPromedio = totals.valorInventario > 0 ? (gananciaPotencial / totals.valorInventario) * 100 : 0;

  // ===== EXCEL IMPORT/EXPORT HANDLERS =====
  const handleImportClick = () => {
    importFileRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al importar');
        setImporting(false);
        return;
      }

      // Mostrar resultado
      const parts: string[] = [];
      if (data.created > 0) parts.push(`${data.created} creados`);
      if (data.updated > 0) parts.push(`${data.updated} actualizados`);
      if (data.skipped > 0) parts.push(`${data.skipped} omitidos (sin nombre)`);
      if (data.categoriesCreated?.length > 0) parts.push(`${data.categoriesCreated.length} categorias nuevas`);

      if (data.errors?.length > 0) {
        toast.warning(`Importado: ${parts.join(', ')}. ${data.errors.length} errores.`, {
          description: data.errors.slice(0, 5).map((e: any) => `Fila ${e.row}: ${e.name} - ${e.reason}`).join('\n'),
          duration: 8000,
        });
      } else {
        toast.success(`Importado: ${parts.join(', ')}`);
      }

      onRefresh();
    } catch {
      toast.error('Error de conexion al importar');
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/products/export');
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Error al exportar');
        setExporting(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Inventario exportado correctamente');
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const openCreateProduct = () => {
    if (products.length >= maxProducts) {
      toast.error(`Limite de productos alcanzado (${maxProducts}). Actualice su licencia para mas productos.`);
      return;
    }
    setEditingProduct(null);
    setFormData({ name: "", description: "", barcode: "", price: "", cost: "", stock: "", categoryId: "", icon: "", wholesalePrice: "", minWholesaleQty: "", noStock: false, vendePorPeso: false, unidadPeso: "kg" });
    setShowProductDialog(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      barcode: product.barcode,
      price: product.price.toString(),
      cost: product.cost.toString(),
      stock: product.stock.toString(),
      categoryId: product.categoryId || "",
      icon: product.icon || "",
      wholesalePrice: (product.wholesalePrice || 0).toString(),
      minWholesaleQty: (product.minWholesaleQty || 0).toString(),
      noStock: product.noStock || false,
      vendePorPeso: product.vendePorPeso || false,
      unidadPeso: product.unidadPeso || "kg",
    });
    setShowProductDialog(true);
  };

  const saveProduct = async () => {
    if (!formData.name || !formData.price) {
      toast.error("Nombre y precio son requeridos");
      return;
    }

    try {
      const url = editingProduct ? "/api/products" : "/api/products";
      const method = editingProduct ? "PUT" : "POST";
      const body = editingProduct
        ? { id: editingProduct.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(editingProduct ? "Producto actualizado" : "Producto creado");
      setShowProductDialog(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Desactivar este producto?")) return;
    try {
      await fetch(`/api/products?id=${id}`, { method: "DELETE" });
      toast.success("Producto desactivado");
      onRefresh();
    } catch {
      toast.error("Error al desactivar producto");
    }
  };

  const createCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim(), icon: newCatIcon || "", color: newCatColor || "#6366f1" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Categoría creada");
      setCategoryName("");
      setShowCategoryDialog(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      toast.success("Categoría eliminada");
      onRefresh();
    } catch {
      toast.error("Error al eliminar categoría");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        {products.length >= maxProducts && (
          <div className="w-full mb-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
            Ha alcanzado el limite de {maxProducts} productos para su plan {licenseType.toUpperCase()}. Actualice su licencia para agregar mas.
          </div>
        )}

        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <Input
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={filterCategory} onChange={(e: any) => setFilterCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCategoryDialog(true)}>
            Categorías
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setBulkPreview([]); setBulkApplied(false); setBulkPercentage(""); setShowBulkPrice(true); }} className="text-orange-600 border-orange-300 hover:bg-orange-50">
            📊 Ajuste de Precios
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportClick} disabled={importing}>
            {importing ? "Importando..." : "Importar Excel"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowBarcodePrint(true)}>
            🏷️ Etiquetas
          </Button>
          <Button size="sm" onClick={openCreateProduct}>
            + Producto
          </Button>
          <input
            type="file"
            ref={importFileRef}
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* ===== RESUMEN FINANCIERO DEL INVENTARIO ===== */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">&#128200;</span>
              <span className="text-sm font-bold">Resumen del Inventario</span>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => setShowFinance(!showFinance)}>
              {showFinance ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
          {showFinance && (
            <>
              {/* 3 tarjetas principales */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="bg-white rounded-lg border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Valor del Inventario</p>
                  <p className="text-lg font-bold text-blue-600">{currency} {totals.valorInventario.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">Bs {(totals.valorInventario * bcvRate).toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-lg border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Capital Invertido</p>
                  <p className="text-lg font-bold text-orange-600">{currency} {totals.capitalInvertido.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">Bs {(totals.capitalInvertido * bcvRate).toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-lg border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Ganancia Potencial</p>
                  <p className={`text-lg font-bold ${gananciaPotencial >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currency} {gananciaPotencial.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Bs {(gananciaPotencial * bcvRate).toFixed(2)}</p>
                </div>
              </div>
              {/* Barra de margen + stats adicionales */}
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Margen promedio del inventario</span>
                    <span className="font-bold text-foreground">{margenPromedio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${margenPromedio >= 40 ? 'bg-green-500' : margenPromedio >= 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.max(margenPromedio, 0), 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span>{products.length} productos registrados</span>
                  <span>|</span>
                  <span>{totals.productosConStock} con stock</span>
                  <span>|</span>
                  <span>{totals.productosSinStock} sin stock</span>
                  <span>|</span>
                  <span>{totals.totalUnidades} unidades totales</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== PANEL DE ALERTAS DE STOCK ===== */}
      {stockAlerts && stockAlerts.totalAlerts > 0 && showAlerts && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">&#9888;</span>
              <span className="text-sm font-bold text-orange-700">
                Alertas de Stock ({stockAlerts.totalAlerts})
              </span>
              <Badge variant="destructive" className="text-[10px]">{stockAlerts.zeroStockCount} sin stock</Badge>
              <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-300">{stockAlerts.lowStockCount} stock bajo</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setShowAlerts(false)}>
              Ocultar
            </Button>
          </div>

          {/* Sin stock */}
          {stockAlerts.zeroStock.length > 0 && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-3">
              <p className="text-xs font-bold text-red-700 mb-2">&#10060; Sin Stock ({stockAlerts.zeroStock.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {stockAlerts.zeroStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-red-100">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span>{p.icon || '&#128230;'}</span>
                      <span className="font-medium truncate">{p.name}</span>
                      {p.categoryName && <CatBadge categoryName={p.categoryName} categories={categories} />}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-red-600 font-bold">0 uds</span>
                      <span className="text-muted-foreground text-[10px]">min: {p.minStock}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock bajo */}
          {stockAlerts.lowStock.length > 0 && (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
              <p className="text-xs font-bold text-orange-700 mb-2">&#128308; Stock Bajo ({stockAlerts.lowStock.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {stockAlerts.lowStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-orange-100">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span>{p.icon || '&#128230;'}</span>
                      <span className="font-medium truncate">{p.name}</span>
                      {p.categoryName && <CatBadge categoryName={p.categoryName} categories={categories} />}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-orange-600 font-bold">{p.stock} uds</span>
                      <span className="text-muted-foreground text-[10px]">min: {p.minStock} (falta {p.deficit})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Boton para re-mostrar alertas si estan ocultas */}
      {stockAlerts && stockAlerts.totalAlerts > 0 && !showAlerts && (
        <Button variant="outline" size="sm" className="text-xs" onClick={() => { setShowAlerts(true); loadStockAlerts(); }}>
          &#9888; Mostrar Alertas de Stock ({stockAlerts.totalAlerts})
        </Button>
      )}

      {/* Tabla de Productos */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Icono</th>
                  <th className="text-left p-2 font-medium">Producto</th>
                  <th className="text-left p-2 font-medium">Código</th>
                  <th className="text-right p-2 font-medium">Precio Bs</th>
                  <th className="text-right p-2 font-medium">Precio USD</th>
                  <th className="text-right p-2 font-medium">Mayorista</th>
                  <th className="text-right p-2 font-medium">Costo</th>
                  <th className="text-right p-2 font-medium">Stock</th>
                  <th className="text-right p-2 font-medium">Margen</th>
                  <th className="text-left p-2 font-medium">Categoría</th>
                  <th className="text-center p-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t hover:bg-muted/30">
                    <td className="p-2">
                      <span className="text-lg">{product.icon || ""}</span>
                    </td>
                    <td className="p-2 font-medium">
                      <span className="flex items-center gap-1">
                        {product.name}
                        {product.noStock && <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-1">Sin Stock</Badge>}
                        {product.vendePorPeso && <Badge variant="outline" className="text-[8px] px-1 py-0 ml-1 text-orange-600 border-orange-300">Por Peso ({product.unidadPeso || 'kg'})</Badge>}
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground">{product.barcode || "-"}</td>
                    <td className="p-2 text-right font-bold text-green-600">
                      Bs {(product.price * bcvRate).toFixed(2)}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">
                      {currency} {product.price.toFixed(2)}
                    </td>
                    <td className="p-2 text-right">
                      {product.wholesalePrice > 0 ? (
                        <span className="text-emerald-600 font-medium text-xs">${product.wholesalePrice.toFixed(2)} x{product.minWholesaleQty}+</span>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="p-2 text-right">{currency} {product.cost.toFixed(2)}</td>
                    <td className="p-2 text-right">
                      <Badge variant={product.stock > (product.minStock || 5) ? "secondary" : "destructive"}>
                        {product.stock}
                      </Badge>
                    </td>
                    <td className="p-2 text-right">
                      {product.cost > 0 && product.price > 0 ? (
                        <span className={`text-xs font-medium ${((product.price - product.cost) / product.price * 100) >= 30 ? 'text-green-600' : ((product.price - product.cost) / product.price * 100) >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {((product.price - product.cost) / product.price * 100).toFixed(0)}%
                        </span>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="p-2">{product.category?.name || "-"}</td>
                    <td className="p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button variant="ghost" size="sm" onClick={() => openEditProduct(product)} className="h-7 text-xs">
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteProduct(product.id)} className="h-7 text-xs text-destructive">
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center p-8 text-muted-foreground">
                      No se encontraron productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo Producto */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Icono (Emoji)</Label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="e.g. 🛒 🍕 🥤"
                className="text-lg"
              />
            </div>
            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre del producto"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            <div>
              <Label>Código de barras</Label>
              <div className="relative">
                <Input
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Código de barras"
                  className="pr-20"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="absolute right-1 top-1 h-8 text-xs"
                  onClick={openBarcodeScanner}
                >
                  &#128247;
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Precio ({currency}) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Costo ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                />
              </div>
              <div>
                <Label>Precio Mayorista ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.wholesalePrice}
                  onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                  placeholder="0 = sin precio mayorista"
                />
              </div>
              <div>
                <Label>Cant. Min. Mayorista</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.minWholesaleQty}
                  onChange={(e) => setFormData({ ...formData, minWholesaleQty: e.target.value })}
                  placeholder="0 = desactivado"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">A partir de esta cantidad se aplica precio mayorista</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stock</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select
                  value={formData.categoryId}
                  onChange={(e: any) => setFormData({ ...formData, categoryId: e.target.value })}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {formData.price && bcvRate > 0 && (
              <p className="text-sm text-green-600">
                Precio en Bs: Bs {(parseFloat(formData.price) * bcvRate).toFixed(2)}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="noStock"
                  checked={formData.noStock}
                  onChange={(e) => setFormData({ ...formData, noStock: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="noStock" className="text-sm font-normal cursor-pointer">
                  Sin control de stock
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vendePorPeso"
                  checked={formData.vendePorPeso}
                  onChange={(e) => setFormData({ ...formData, vendePorPeso: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="vendePorPeso" className="text-sm font-normal cursor-pointer">
                  Vender por peso (carniceria, fruteria, etc.)
                </Label>
              </div>
            </div>
            {formData.vendePorPeso && (
              <div>
                <Label className="text-xs text-muted-foreground">Unidad de peso</Label>
                <div className="flex gap-2 mt-1">
                  {["kg", "g", "lb"].map((u) => (
                    <button key={u} type="button" onClick={() => setFormData({ ...formData, unidadPeso: u })}
                      className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${formData.unidadPeso === u ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={saveProduct}>
              {editingProduct ? "Actualizar" : "Crear"} Producto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== DIALOGO SCANNER CODIGO DE BARRAS ====== */}
      <Dialog open={showBarcodeScanner} onOpenChange={(open) => { if (!open) stopBarcodeScanner(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              &#128247; Escanear Codigo de Barras
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {barcodeScannerLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Iniciando camara...</p>
              </div>
            )}
            {barcodeScannerError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-lg flex-shrink-0">&#9888;</span>
                  <div className="text-sm text-red-700 space-y-2">
                    <p className="font-semibold">Error con la camara</p>
                    <p>{barcodeScannerError}</p>
                    <div className="text-xs text-red-600 bg-red-100 rounded p-2">
                      <p className="font-semibold mb-1">Pasos para solucionar:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Clic en el icono de candado en la barra de direccion</li>
                        <li>Busque "Camara" y seleccione "Permitir"</li>
                        <li>Recargue la pagina (F5) e intente de nuevo</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={stopBarcodeScanner}>Cerrar</Button>
                  <Button className="flex-1" onClick={openBarcodeScanner}>Reintentar</Button>
                </div>
              </div>
            )}
            {!barcodeScannerLoading && !barcodeScannerError && (
              <>
                <div
                  id={barcodeScannerDivId.current}
                  className="rounded-lg overflow-hidden"
                  style={{ minHeight: "250px" }}
                />
                <style>{`
                  #${barcodeScannerDivId.current} img[alt="Info icon"] { display: none !important; }
                  #${barcodeScannerDivId.current} button { display: none !important; }
                `}</style>
                <p className="text-xs text-center text-muted-foreground">
                  Apunte la camara hacia el codigo de barras o QR del producto.
                </p>
              </>
            )}
            <Input
              placeholder="O escriba el codigo manualmente..."
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              className="font-mono text-center"
            />
            <Button variant="outline" className="w-full" onClick={stopBarcodeScanner}>Cerrar Scanner</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo Categorías */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorías</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Nueva categoría"
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
              />
              <Button onClick={createCategory}>Agregar</Button>
            </div>
            <Separator />
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                  <span className="text-sm">
                    {cat.name}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({cat._count?.products || 0} productos)
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCategory(cat.id)}
                    className="text-destructive text-xs h-7"
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  No hay categorías
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== ETIQUETAS DE CODIGO DE BARRAS ===== */}
      {showBarcodePrint && (
        <BarcodePrint products={products} bcvRate={bcvRate} currency={currency} />
      )}

      {/* ===== DIALOG AJUSTE MASIVO DE PRECIOS ===== */}
      <Dialog open={showBulkPrice} onOpenChange={(open) => { if (!open) setShowBulkPrice(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>📊</span>
              <span>Ajuste Masivo de Precios</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selector de alcance */}
            <div>
              <Label>Aplicar a</Label>
              <Select value={bulkTarget} onChange={(e: any) => { setBulkTarget(e.target.value); setBulkPreview([]); setBulkApplied(false); }}>
                <option value="ALL">Todo el inventario ({products.length} productos)</option>
                {categories.filter(c => products.some(p => p.categoryId === c.id)).map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? cat.icon + ' ' : ''}{cat.name} ({products.filter(p => p.categoryId === cat.id).length} productos)
                  </option>
                ))}
              </Select>
            </div>

            {/* Tipo de ajuste */}
            <div>
              <Label>Tipo de ajuste</Label>
              <Select value={bulkApplyTo} onChange={(e: any) => { setBulkApplyTo(e.target.value); setBulkPreview([]); setBulkApplied(false); }}>
                <option value="sale">Aumentar precio de VENTA</option>
                <option value="cost">Aumentar precio de COMPRA (costo)</option>
                <option value="both">Aumentar VENTA y COMPRA (ambos)</option>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {bulkApplyTo === 'sale' ? 'Solo modifica el precio de venta que ven los clientes.'
                  : bulkApplyTo === 'cost' ? 'Solo modifica el costo de compra (para ajuste de proveedor).'
                  : 'Modifica precio de venta, costo y precio mayorista.'}
              </p>
            </div>

            {/* Porcentaje */}
            <div>
              <Label>Porcentaje de ajuste</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={bulkPercentage}
                  onChange={(e) => { setBulkPercentage(e.target.value); setBulkPreview([]); setBulkApplied(false); }}
                  placeholder="Ej: 20"
                  className="w-32"
                />
                <span className="text-sm font-medium">%</span>
                <span className="text-xs text-muted-foreground">
                  {bulkPercentage && parseFloat(bulkPercentage) > 0 && ' (aumenta precios)'}
                  {bulkPercentage && parseFloat(bulkPercentage) < 0 && ' (reduce precios)'}
                  {bulkPercentage && parseFloat(bulkPercentage) === 0 && ' (sin cambio)'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ejemplos: 20 = subir 20% | -10 = bajar 10% | 50 = subir 50%
              </p>
            </div>

            <Separator />

            {/* Info de productos afectados */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>🎯</span>
                <span>{getBulkAffectedCount()} productos seran afectados</span>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              {!bulkApplied ? (
                <>
                  <Button variant="outline" onClick={() => setShowBulkPrice(false)}>Cancelar</Button>
                  <Button
                    onClick={handleBulkPreview}
                    disabled={bulkLoading || !bulkPercentage || parseFloat(bulkPercentage) === 0}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {bulkLoading ? 'Calculando...' : '👁️ Vista Previa'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setShowBulkPrice(false)}>Cerrar</Button>
              )}
            </div>

            {/* Preview */}
            {bulkPreview.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">
                      {bulkApplied ? '✅ Ajuste aplicado' : '👁️ Vista previa'}
                    </span>
                    <Badge variant={bulkApplied ? "default" : "secondary"} className="text-xs">
                      {bulkPreview.length} productos
                    </Badge>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/70 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">Producto</th>
                            <th className="text-right p-2 font-medium">Precio Antes</th>
                            <th className="text-right p-2 font-medium">Precio Nuevo</th>
                            <th className="text-right p-2 font-medium">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkPreview.map((item, i) => {
                            const diff = item.newPrice - item.oldPrice;
                            const diffPct = item.oldPrice > 0 ? ((item.newPrice - item.oldPrice) / item.oldPrice * 100).toFixed(1) : '0';
                            return (
                              <tr key={i} className={`border-t ${bulkApplied ? 'bg-green-50/50' : 'hover:bg-muted/30'}`}>
                                <td className="p-2 truncate max-w-[150px]">{item.name}</td>
                                <td className="p-2 text-right text-muted-foreground">${item.oldPrice.toFixed(2)}</td>
                                <td className="p-2 text-right font-bold">${item.newPrice.toFixed(2)}</td>
                                <td className={`p-2 text-right font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : ''}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(2)} ({diffPct}%)
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Boton aplicar (solo si no se ha aplicado) */}
                {!bulkApplied && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleBulkApply}
                      disabled={bulkLoading}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                    >
                      {bulkLoading ? 'Aplicando...' : `✅ APLICAR ${parseFloat(bulkPercentage) > 0 ? '+' : ''}${bulkPercentage}% a ${getBulkAffectedCount()} productos`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
