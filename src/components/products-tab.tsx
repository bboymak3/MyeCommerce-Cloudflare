"use client";

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { CropDialog } from "@/components/crop-dialog";
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
import { authFetch } from "@/lib/auth-fetch";

interface Category { id: string; name: string; icon?: string; color?: string; _count?: { products: number }; }
interface Brand { id: string; name: string; _count?: { products: number }; }
interface ComboItemProduct { id: string; name: string; barcode: string; price: number; stock: number; icon?: string; }
interface ComboItemData { id: string; comboId: string; productId: string; quantity: number; product?: ComboItemProduct; }
interface Product {
  id: string; name: string; description: string; barcode: string; secondaryBarcode: string;
  price: number; cost: number; marginPercent: number; taxType: string;
  stock: number; minStock: number; wholesalePrice: number; wholesaleCost: number; wholesaleMarginPercent: number; minWholesaleQty: number;
  granMayorPrice: number; isGranMayor: boolean;
  noStock: boolean; vendePorPeso?: boolean; unidadPeso?: string;
  icon: string; image: string; location: string;
  expirationDate: string | null; lotNumber: string;
  isCombo: boolean; loyaltyPoints: number;
  unitsPerBox: number; boxPrice: number; boxMarginPercent: number;
  categoryId: string | null; category: { name: string } | null; brandId: string | null; brand: { name: string } | null; active: boolean;
  comboItems?: ComboItemData[]; comboItemsRef?: ComboItemData[];
}
interface StockAlert { id: string; name: string; barcode: string; stock: number; minStock: number; price: number; cost: number; icon: string; categoryName: string; deficit: number; }
interface StockAlertsData { totalAlerts: number; zeroStockCount: number; lowStockCount: number; zeroStock: StockAlert[]; lowStock: StockAlert[]; }
interface ProductsTabProps { products: Product[]; categories: Category[]; brands: Brand[]; bcvRate: number; euroUsdtRate: number; currency: string; onRefresh: () => void; maxProducts?: number; licenseType?: string; taxRate?: number; }

function CatBadge({ categoryName, categories }: { categoryName: string; categories: Category[] }) {
  const cat = categories.find(c => c.name === categoryName);
  if (cat?.color) return <Badge variant="secondary" className="text-[8px] px-1 py-0 flex-shrink-0" style={{ backgroundColor: cat.color + '20', color: cat.color, borderColor: cat.color }}>{cat.icon ? cat.icon + ' ' : ''}{categoryName}</Badge>;
  return <Badge variant="secondary" className="text-[8px] px-1 py-0 flex-shrink-0">{categoryName}</Badge>;
}
function TaxBadge({ taxType, taxRate }: { taxType: string; taxRate?: number }) {
  if (taxType === 'exento' || taxType === 'omitido') return <Badge variant="outline" className="text-[9px] text-gray-500 border-gray-300">EXENTO</Badge>;
  const rate = taxRate || 0;
  if (taxType === 'reducido') return <Badge variant="outline" className="text-[9px] text-blue-600 border-blue-300">IVA {rate}%</Badge>;
  return <Badge variant="outline" className="text-[9px] text-orange-600 border-orange-300">IVA {rate}%</Badge>;
}
function Chevron({ open }: { open: boolean }) {
  return <svg className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>;
}
function MarginBar({ margin }: { margin: number }) {
  const c = margin >= 40 ? 'bg-green-500' : margin >= 20 ? 'bg-yellow-500' : margin > 0 ? 'bg-red-500' : 'bg-gray-300';
  return <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${c}`} style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }} title={`${margin}%`} /><span className="text-[8px] ml-1 font-medium">{margin.toFixed(1)}%</span></div>;
}
function Block({ title, icon, badge, defaultOpen = true, children }: { title: string; icon: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden card-shadow">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition text-left">
        <div className="flex items-center gap-2"><span>{icon}</span><span className="text-sm font-semibold">{title}</span>{badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}</div>
        <Chevron open={open} />
      </button>
      {open && <div className="px-4 py-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function ProductsTab({ products, categories, brands, bcvRate, euroUsdtRate, currency, onRefresh, maxProducts = 99999, licenseType = "profesional", taxRate = 0 }: ProductsTabProps) {
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showBarcodePrint, setShowBarcodePrint] = useState(false);
  const emptyForm = { name: "", description: "", barcode: "", secondaryBarcode: "", price: "", cost: "", marginPercent: "", taxType: "general", stock: "", minStock: "5", categoryId: "", brandId: "", icon: "", image: "", wholesalePrice: "", wholesaleCost: "", wholesaleMarginPercent: "", minWholesaleQty: "", granMayorPrice: "", isGranMayor: false, noStock: false, vendePorPeso: false, unidadPeso: "kg", location: "", expirationDate: "", lotNumber: "", isCombo: false, loyaltyPoints: "", unitsPerBox: "", boxPrice: "", boxMarginPercent: "", stockMode: "unit", boxQty: "" };
  const [formData, setFormData] = useState(emptyForm);
  const [categoryName, setCategoryName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [brandName, setBrandName] = useState("");
  // Local brands state that syncs with prop but allows immediate updates
  const [brandsLocal, setBrandsLocal] = useState<Brand[]>(brands);
  const effectiveBrands = brandsLocal.length > 0 || !brands.length ? brandsLocal : brands;
  useEffect(() => { setBrandsLocal(brands); }, [brands]);

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
  // Expiration alerts
  const [expAlerts, setExpAlerts] = useState<any | null>(null);
  const [showExpAlerts, setShowExpAlerts] = useState(true);

  // Stock adjustment dialog (kardex)
  const [showStockAdjustDialog, setShowStockAdjustDialog] = useState(false);
  const [stockAdjustReason, setStockAdjustReason] = useState("");
  const [stockAdjustData, setStockAdjustData] = useState<{ productId: string; productName: string; oldStock: number; newStock: number; productCost: number } | null>(null);
  const [stockAdjustSaving, setStockAdjustSaving] = useState(false);

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
  // Crop dialog
  const [showCrop, setShowCrop] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');

  // Finance summary
  const [showFinance, setShowFinance] = useState(true);

  // ─── EFFECTS ───
  useEffect(() => { (async () => { try { const r = await authFetch('/api/products/stock-alerts'); const d = await r.json(); if (r.ok) { setStockAlerts(d); if (d.totalAlerts === 0) setShowAlerts(false); } } catch {} })(); }, []);
  useEffect(() => { (async () => { try { const r = await authFetch('/api/products/expiration-alerts'); const d = await r.json(); if (r.ok) { setExpAlerts(d); if (d.totalAlerts === 0) setShowExpAlerts(false); } } catch {} })(); }, []);

  // ─── CALC HELPERS ───
  const calcPrice = (cost: string, margin: string) => { const c = parseFloat(cost) || 0, m = parseFloat(margin) || 0; return c > 0 && m >= 0 ? (c * (1 + m / 100)).toFixed(2) : ""; };
  const calcMargin = (price: string, cost: string) => { const p = parseFloat(price) || 0, c = parseFloat(cost) || 0; return p > 0 && c > 0 ? (((p - c) / c) * 100).toFixed(1) : ""; };
  const calcBoxPrice = (cost: string, margin: string, units: string) => { const c = parseFloat(cost) || 0, m = parseFloat(margin) || 0, u = parseInt(units) || 1; return c > 0 && m >= 0 && u > 0 ? ((c / u) * (1 + m / 100)).toFixed(2) : ""; };
  const autoPrice = formData.cost && formData.marginPercent ? calcPrice(formData.cost, formData.marginPercent) : "";
  const autoMargin = formData.price && formData.cost ? calcMargin(formData.price, formData.cost) : "";
  const autoBoxPrice = formData.cost && formData.boxMarginPercent && formData.unitsPerBox ? calcBoxPrice(formData.cost, formData.boxMarginPercent, formData.unitsPerBox) : "";
  // Calculo automatico precio mayorista (igual logica que detal)
  const autoWholesalePrice = formData.wholesaleCost && formData.wholesaleMarginPercent ? calcPrice(formData.wholesaleCost, formData.wholesaleMarginPercent) : "";
  const autoWholesaleMargin = formData.wholesalePrice && formData.wholesaleCost ? calcMargin(formData.wholesalePrice, formData.wholesaleCost) : "";
  // Calculos bulto: costo unitario del bulto, precio venta unitario, stock total
  const boxUnitsPerBox = parseInt(formData.unitsPerBox) || 0;
  const boxCostPerBox = parseFloat(formData.boxPrice) || 0;
  const boxMarginPct = parseFloat(formData.boxMarginPercent) || 0;
  const boxQtyBought = parseInt(formData.boxQty) || 0;
  const boxCostPerUnit = boxUnitsPerBox > 0 && boxCostPerBox > 0 ? parseFloat((boxCostPerBox / boxUnitsPerBox).toFixed(4)) : 0;
  const boxPricePerUnit = boxCostPerUnit > 0 && boxMarginPct > 0 ? parseFloat((boxCostPerUnit / (1 - boxMarginPct / 100)).toFixed(2)) : 0;
  const boxTotalStock = boxQtyBought * boxUnitsPerBox;

  // ─── FILTERED PRODUCTS ───
  const filtered = products.filter(p => {
    const s = search.toLowerCase();
    const matchSearch = !s || p.name?.toLowerCase().includes(s) || (p.barcode || '').toLowerCase().includes(s) || (p.secondaryBarcode || '').toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s) || (p.brand?.name || '').toLowerCase().includes(s);
    return matchSearch && (!filterCategory || p.categoryId === filterCategory) && (!filterBrand || p.brandId === filterBrand);
  });

  // ─── PAGINATION ───
  const ITEMS_PER_PAGE = 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  useEffect(() => { setPage(1); }, [search, filterCategory, filterBrand]);

  // ─── FINANCE TOTALS ───
  // Solo considerar productos con stock > 0 y con precio > 0
  const activeProducts = products.filter(p => p.stock > 0 && p.price > 0);
  const totals = activeProducts.reduce((a, p) => {
    // Valor de inventario = precio de venta x stock (a cuanto puedo vender)
    a.val += p.price * p.stock;
    // Capital invertido = costo de compra x stock (cuanto me costo)
    a.inv += (p.cost || 0) * p.stock;
    a.units += p.stock;
    a.withStock += 1;
    return a;
  }, { val: 0, inv: 0, units: 0, withStock: 0, noStock: 0 });
  const noStockCount = products.filter(p => p.stock <= 0 && !p.noStock).length;
  // Ganancia potencial = Valor de venta - Capital invertido
  const gain = totals.val - totals.inv;
  // Margen promedio = Ganancia / Valor de venta (porcentaje sobre el precio)
  const avgMargin = totals.val > 0 ? (gain / totals.val) * 100 : 0;

  // ─── HANDLERS ───
  const openCreate = () => { if (products.length >= maxProducts) { toast.error(`Limite de ${maxProducts} productos`); return; } setEditingProduct(null); setFormData(emptyForm); setComboItems([]); setShowProductDialog(true); };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({ name: p.name, description: p.description, barcode: p.barcode, secondaryBarcode: p.secondaryBarcode || "", price: p.price.toString(), cost: p.cost.toString(), marginPercent: (p.marginPercent || 0).toString(), taxType: p.taxType || "general", stock: p.stock.toString(), minStock: (p.minStock || 5).toString(), categoryId: p.categoryId || "", brandId: p.brandId || "", icon: p.icon || "", image: p.image || "", wholesalePrice: (p.wholesalePrice || 0).toString(), wholesaleCost: (p.wholesaleCost || 0).toString(), wholesaleMarginPercent: (p.wholesaleMarginPercent || 0).toString(), minWholesaleQty: (p.minWholesaleQty || 0).toString(), granMayorPrice: (p.granMayorPrice || 0).toString(), isGranMayor: p.isGranMayor || false, noStock: p.noStock || false, vendePorPeso: p.vendePorPeso || false, unidadPeso: p.unidadPeso || "kg", location: p.location || "", expirationDate: p.expirationDate ? p.expirationDate.split("T")[0] : "", lotNumber: p.lotNumber || "", isCombo: p.isCombo || false, loyaltyPoints: (p.loyaltyPoints || 0).toString(), unitsPerBox: (p.unitsPerBox || 0).toString(), boxPrice: (p.boxPrice || 0).toString(), boxMarginPercent: (p.boxMarginPercent || 0).toString() });
    setShowProductDialog(true);
    if (p.isCombo && p.id) { (async () => { try { const r = await authFetch(`/api/products/combo-items?comboId=${p.id}`); if (r.ok) setComboItems(await r.json()); } catch { setComboItems([]); } })(); } else setComboItems([]);
  };

  const saveProduct = async () => {
    if (!formData.name || !formData.price) { toast.error("Nombre y precio requeridos"); return; }
    // Detectar cambio de stock en edición → requiere ajuste kardex
    if (editingProduct && formData.stock !== undefined) {
      const oldStock = editingProduct.stock;
      const newStock = parseFloat(formData.stock) || 0;
      if (oldStock !== newStock) {
        setStockAdjustData({
          productId: editingProduct.id,
          productName: editingProduct.name,
          oldStock,
          newStock,
          productCost: editingProduct.cost || 0,
        });
        setShowStockAdjustDialog(true);
        return;
      }
    }
    try {
      const res = await authFetch("/api/products", { method: editingProduct ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingProduct ? { id: editingProduct.id, ...formData } : formData) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success(editingProduct ? "Producto actualizado" : "Producto creado");
      setShowProductDialog(false); onRefresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const confirmStockAdjust = async () => {
    if (!stockAdjustData || !stockAdjustReason.trim()) { toast.error("Debe indicar el motivo del ajuste de inventario"); return; }
    setStockAdjustSaving(true);
    try {
      // 1) Actualizar el producto con todos los datos del formulario
      const res = await authFetch("/api/products", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: stockAdjustData.productId, ...formData }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      // 2) Registrar movimiento en kardex
      const diff = stockAdjustData.newStock - stockAdjustData.oldStock;
      const adjRes = await authFetch("/api/inventory-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: stockAdjustData.productId,
          productName: stockAdjustData.productName,
          oldStock: stockAdjustData.oldStock,
          newStock: stockAdjustData.newStock,
          quantity: Math.abs(diff),
          movementType: diff > 0 ? "ajuste_entrada" : "ajuste_salida",
          reason: stockAdjustReason.trim(),
          unitCost: stockAdjustData.productCost,
        }),
      });
      if (!adjRes.ok) { const d = await adjRes.json(); throw new Error(d.error || "Error al registrar ajuste en kardex"); }
      toast.success(`Producto actualizado. Ajuste de inventario registrado en Kardex (${diff > 0 ? '+' : ''}${diff} uds)`);
      setShowStockAdjustDialog(false);
      setShowProductDialog(false);
      setStockAdjustReason("");
      setStockAdjustData(null);
      onRefresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setStockAdjustSaving(false); }
  };

  const deleteProduct = async (id: string) => { if (!confirm("Desactivar producto?")) return; try { await authFetch(`/api/products?id=${id}`, { method: "DELETE" }); toast.success("Desactivado"); onRefresh(); } catch { toast.error("Error"); } };

  const createCategory = async () => {
    if (!categoryName.trim()) return;
    try {
      const r = await authFetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: categoryName.trim(), icon: newCatIcon, color: newCatColor }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al crear categoria");
      toast.success("Categoria creada");
      setCategoryName(""); setNewCatIcon(""); setNewCatColor("#6366f1"); setShowCategoryDialog(false);
      onRefresh();
    } catch (e: any) { toast.error(e.message || "Error al crear categoria"); }
  };
  const deleteCategory = async (id: string) => { if (!confirm("Eliminar categoria?")) return; try { await authFetch(`/api/categories?id=${id}`, { method: "DELETE" }); toast.success("Eliminada"); onRefresh(); } catch {} };

  const createBrand = async () => {
    if (!brandName.trim()) return;
    try {
      const r = await authFetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: brandName.trim() }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al crear marca");
      // Actualizar lista local de marcas inmediatamente
      if (data && data.id) {
        setBrandsLocal(prev => {
          const exists = prev.find((b: Brand) => b.id === data.id);
          if (exists) return prev.map((b: Brand) => b.id === data.id ? data : b);
          return [...prev, data];
        });
      }
      toast.success("Marca creada");
      setBrandName("");
      onRefresh();
    } catch (e: any) { toast.error(e.message || "Error al crear marca"); }
  };
  const deleteBrand = async (id: string) => { if (!confirm("Eliminar marca?")) return; try { await authFetch(`/api/brands?id=${id}`, { method: "DELETE" }); toast.success("Eliminada"); onRefresh(); } catch {} };

  // Scanner
  const openScanner = async () => {
    setShowScanner(true); setScannerLoading(true); setScannerError("");
    // Esperar a que el Dialog renderice el div del scanner
    await new Promise(r => setTimeout(r, 400));
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      // Verificar que el div existe
      const divEl = document.getElementById(scannerDivId.current);
      if (!divEl) throw new Error("No se encontro el elemento del escaner. Reintente.");
      const qr = new Html5Qrcode(scannerDivId.current);
      scannerRef.current = qr;
      await qr.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } }, (txt: string) => { stopScanner(); setFormData(p => ({ ...p, barcode: txt })); toast.success("Escaneado: " + txt); }, () => {});
      setScannerLoading(false);
    } catch (e: any) {
      setScannerLoading(false);
      const m = (e?.message || "").toLowerCase();
      let errMsg = "Error al iniciar escaner.";
      if (m.includes("permission") || m.includes("notallowederror")) errMsg = "Permiso de camara denegado. Active la camara en el navegador (icono de candado) y recargue la pagina.";
      else if (m.includes("notfound") || m.includes("notfounderror")) errMsg = "No se encontro camara. Verifique que este conectada y no este en uso por otra app.";
      else if (m.includes("notsecure") || m.includes("secure context")) errMsg = "La camara requiere conexion segura (HTTPS). Use https://myecommerce.ve en lugar de http://localhost.";
      else if (m.includes("notreadable") || m.includes("aborterror")) errMsg = "La camara esta siendo usada por otra aplicacion. Cierre otras apps que usen la camara.";
      setScannerError(errMsg);
    }
  };
  const stopScanner = async () => { try { if (scannerRef.current) { if (scannerRef.current.getState() === 2) await scannerRef.current.stop(); scannerRef.current.clear(); scannerRef.current = null; } } catch {} setShowScanner(false); setScannerError(""); };

  // Image — con compresion automatica para fotos grandes de celular
  const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      // Comprimir siempre que sea imagen (aunque sea menor a 500KB) para optimizar red móvil
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      // Solo saltar compresión si ya es muy pequeña (< 100KB)
      if (file.size < 100 * 1024) {
        resolve(file);
        return;
      }
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          // Reducir más agresivamente para carga rápida en móvil
          if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
          if (h > maxWidth) { w = (w * maxWidth) / h; h = maxWidth; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(file); return; }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (!blob) { resolve(file); return; }
            // Usar WebP si el browser soporta, es más ligero
            const mimeType = canvas.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
            canvas.toBlob((webpBlob) => {
              if (webpBlob && webpBlob.size < blob.size) {
                const compressed = new File([webpBlob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp', lastModified: Date.now() });
                resolve(compressed);
              } else {
                const compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                resolve(compressed);
              }
            }, mimeType, quality);
          }, 'image/jpeg', quality);
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };
  const uploadImage = async (file: File) => { setUploading(true); try { const compressed = await compressImage(file); const fd = new FormData(); fd.append("image", compressed); const r = await authFetch("/api/product-images", { method: "POST", body: fd }); const d = await r.json(); if (!r.ok) { toast.error(d.error || "Error al subir"); return; } if (d.imageUrl) { setFormData(p => ({ ...p, image: d.imageUrl })); toast.success("Imagen subida"); } } catch { toast.error("Error al subir"); } finally { setUploading(false); } };

  // Combo items
  const addComboItem = async () => {
    if (!editingProduct?.id || !addComboProductId) return;
    setComboLoading(true);
    try {
      const r = await authFetch("/api/products/combo-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comboId: editingProduct.id, productId: addComboProductId, quantity: parseInt(addComboQty) || 1 }) });
      if (r.ok) { const item = await r.json(); setComboItems(prev => [...prev, item]); setAddComboProductId(""); setAddComboQty("1"); toast.success("Agregado al combo"); } else { const err = await r.json(); toast.error(err.error); }
    } catch { toast.error("Error"); } finally { setComboLoading(false); }
  };
  const removeComboItem = async (id: string) => { setComboLoading(true); try { await authFetch(`/api/products/combo-items?id=${id}`, { method: "DELETE" }); setComboItems(prev => prev.filter(i => i.id !== id)); toast.success("Removido"); } catch {} setComboLoading(false); };

  // Bulk
  const handleBulkPreview = () => { const pct = parseFloat(bulkPercentage); if (!pct) { toast.error("Porcentaje invalido"); return; } setBulkLoading(true); const tp = bulkTarget === "ALL" ? products : products.filter(p => p.categoryId === bulkTarget); const as = bulkApplyTo === "sale" || bulkApplyTo === "both"; const ac = bulkApplyTo === "cost" || bulkApplyTo === "both"; setBulkPreview(tp.map(p => { const f = 1 + pct / 100; return { name: p.name, oldPrice: p.price, newPrice: as && p.price > 0 ? +(p.price * f).toFixed(4) : p.price, oldCost: p.cost, newCost: ac && p.cost > 0 ? +(p.cost * f).toFixed(4) : p.cost }; })); setBulkLoading(false); };
  const handleBulkApply = async () => { const pct = parseFloat(bulkPercentage); if (!pct) return; if (!confirm(`Aplicar ${pct > 0 ? '+' : ''}${pct}% a ${getBulkCount()} productos?`)) return; setBulkLoading(true); try { const r = await authFetch('/api/products', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bulk-price', categoryId: bulkTarget, percentage: pct, applyTo: bulkApplyTo }) }); const d = await r.json(); if (!r.ok) { toast.error(d.error); setBulkLoading(false); return; } toast.success(`${d.updatedCount} productos actualizados`); setBulkPreview(d.preview || []); setBulkApplied(true); onRefresh(); } catch { toast.error("Error"); } setBulkLoading(false); };

  // Import/Export
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setImporting(true); try { const fd = new FormData(); fd.append('file', f); const r = await authFetch('/api/products/import', { method: 'POST', body: fd }); const d = await r.json(); if (!r.ok) toast.error(d.error); else { const p: string[] = []; if (d.created > 0) p.push(`${d.created} creados`); if (d.updated > 0) p.push(`${d.updated} actualizados`); toast.success(p.join(', ')); onRefresh(); } } catch { toast.error("Error"); } setImporting(false); if (importFileRef.current) importFileRef.current.value = ''; };
  const handleExport = async () => { setExporting(true); try { const r = await authFetch('/api/products/export'); if (!r.ok) { toast.error("Error"); setExporting(false); return; } const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); toast.success("Exportado"); } catch { toast.error("Error"); } setExporting(false); };

  // Available products for combo (exclude self)
  const comboAvailable = products.filter(p => p.id !== editingProduct?.id && p.active);

  return (
    <div className="space-y-3">
      {/* ─── TOOLBAR: SEARCH + FILTERS + ACTIONS ─── */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        {/* Search Bar + Filters */}
        <div className="flex gap-2 flex-1 w-full sm:w-auto items-center">
          {/* Main Search */}
          <div className="search-bar flex-1">
            <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              placeholder="Buscar por nombre, codigo, marca, descripcion..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-10 rounded-xl border bg-card px-3 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all min-w-[110px]"
          >
            <option value="">Categorias</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Brand Filter */}
          <select
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            className="h-10 rounded-xl border bg-card px-3 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all min-w-[110px]"
          >
            <option value="">Marcas</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {/* Action Buttons */}
        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowCategoryDialog(true)} className="text-xs h-9">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
            Categorias
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setBulkPreview([]); setBulkApplied(false); setBulkPercentage(""); setShowBulkPrice(true); }} className="text-xs h-9 text-orange-600 border-orange-200 hover:bg-orange-50">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Ajuste Precios
          </Button>
          <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()} disabled={importing} className="text-xs h-9">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Importar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="text-xs h-9">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowBarcodePrint(true)} className="text-xs h-9">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /></svg>
            Etiquetas
          </Button>
          <Button size="sm" onClick={openCreate} className="text-xs h-9 shadow-sm">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Producto
          </Button>
          <input type="file" ref={importFileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* Search result count */}
      {(search || filterCategory || filterBrand) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{filtered.length} producto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={() => { setSearch(""); setFilterCategory(""); setFilterBrand(""); }} className="text-primary hover:underline font-medium">Limpiar filtros</button>
        </div>
      )}

      {/* FINANCE SUMMARY */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent card-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">Resumen del Inventario</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">{totals.withStock} productos con stock &bull; {noStockCount} sin stock</span>
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowFinance(!showFinance)}>{showFinance ? 'Ocultar' : 'Mostrar'}</Button>
            </div>
          </div>
          {showFinance && (
            <div className="grid grid-cols-3 gap-3">
              <div className="metric-card text-center">
                <p className="metric-label">Valor Inventario</p>
                <p className="metric-value text-blue-600 dark:text-blue-400">{currency} {totals.val.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Precio venta x {totals.units.toFixed(0)} uds</p>
              </div>
              <div className="metric-card text-center">
                <p className="metric-label">Capital Invertido</p>
                <p className="metric-value text-orange-600 dark:text-orange-400">{currency} {totals.inv.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Costo compra x {totals.units.toFixed(0)} uds</p>
              </div>
              <div className="metric-card text-center">
                <p className="metric-label">Ganancia Potencial</p>
                <p className={`metric-value ${gain >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{currency} {gain.toFixed(2)}</p>
                <div className="mt-1.5"><MarginBar margin={avgMargin} /></div>
                <p className="text-[10px] text-muted-foreground">Margen {avgMargin.toFixed(1)}%</p>
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
            <div className="alert-card-danger">
              <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">SIN STOCK ({stockAlerts.zeroStock.length})</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {stockAlerts.zeroStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-white dark:bg-card rounded-lg px-3 py-1.5 border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-1.5"><span dangerouslySetInnerHTML={{ __html: p.icon || '' }} /><span className="truncate font-medium">{p.name}</span></div>
                    <span className="text-red-600 dark:text-red-400 font-bold">0 uds</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stockAlerts.lowStock.length > 0 && (
            <div className="alert-card-warning">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">STOCK BAJO ({stockAlerts.lowStock.length})</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {stockAlerts.lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-white dark:bg-card rounded-lg px-3 py-1.5 border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-1.5"><span dangerouslySetInnerHTML={{ __html: p.icon || '' }} /><span className="truncate font-medium">{p.name}</span></div>
                    <div className="flex items-center gap-1"><span className="text-amber-600 dark:text-amber-400 font-bold">{p.stock}</span><span className="text-muted-foreground">falta {p.deficit}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alertas de Vencimiento */}
      {showExpAlerts && expAlerts && expAlerts.totalAlerts > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">&#9888;&#65039;</span>
                <span className="text-sm font-bold text-red-700">Alertas de Vencimiento ({expAlerts.totalAlerts})</span>
              </div>
              <div className="flex items-center gap-2">
                {expAlerts.expiredCount > 0 && <Badge variant="destructive" className="text-[9px]">{expAlerts.expiredCount} Vencidos</Badge>}
                {expAlerts.warningSoonCount > 0 && <Badge className="text-[9px]" style={{backgroundColor:'#f59e0b',color:'#fff'}}>{expAlerts.warningSoonCount} &lt;15 dias</Badge>}
                {expAlerts.warning30Count > 0 && <Badge className="text-[9px]" style={{backgroundColor:'#fb923c',color:'#fff'}}>{expAlerts.warning30Count} &lt;30 dias</Badge>}
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowExpAlerts(false)}>Ocultar</Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-red-100/50 sticky top-0">
                  <tr>
                    <th className="text-left p-1">Producto</th>
                    <th className="text-left p-1">Categoria</th>
                    <th className="text-right p-1">Stock</th>
                    <th className="text-right p-1">Precio</th>
                    <th className="text-right p-1">Vencimiento</th>
                    <th className="text-right p-1">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {(expAlerts.expired || []).map((p: any) => (
                    <tr key={p.id} className="border-t bg-red-100/40">
                      <td className="p-1 font-medium">{p.icon} {p.name}</td>
                      <td className="p-1">{p.categoryName}</td>
                      <td className="p-1 text-right">{p.stock}</td>
                      <td className="p-1 text-right">${p.price.toFixed(2)}</td>
                      <td className="p-1 text-right">{new Date(p.expirationDate).toLocaleDateString('es-VE')}</td>
                      <td className="p-1 text-right font-bold text-red-700">{p.daysLeft <= 0 ? 'VENCIDO' : `${p.daysLeft}d`}</td>
                    </tr>
                  ))}
                  {(expAlerts.warningSoon || []).map((p: any) => (
                    <tr key={p.id} className="border-t bg-amber-50/40">
                      <td className="p-1 font-medium">{p.icon} {p.name}</td>
                      <td className="p-1">{p.categoryName}</td>
                      <td className="p-1 text-right">{p.stock}</td>
                      <td className="p-1 text-right">${p.price.toFixed(2)}</td>
                      <td className="p-1 text-right">{new Date(p.expirationDate).toLocaleDateString('es-VE')}</td>
                      <td className="p-1 text-right font-bold text-amber-700">{p.daysLeft}d</td>
                    </tr>
                  ))}
                  {(expAlerts.warning30 || []).map((p: any) => (
                    <tr key={p.id} className="border-t bg-orange-50/30">
                      <td className="p-1 font-medium">{p.icon} {p.name}</td>
                      <td className="p-1">{p.categoryName}</td>
                      <td className="p-1 text-right">{p.stock}</td>
                      <td className="p-1 text-right">${p.price.toFixed(2)}</td>
                      <td className="p-1 text-right">{new Date(p.expirationDate).toLocaleDateString('es-VE')}</td>
                      <td className="p-1 text-right font-bold text-orange-600">{p.daysLeft}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRODUCTS TABLE */}
      <Card className="card-shadow">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="elegant-table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Producto</th>
                  <th>Marca / Cat.</th>
                  <th className="text-right">USD</th>
                  <th className="text-right">Bs</th>
                  <th className="text-right">Costo</th>
                  <th className="text-right">Margen</th>
                  <th className="text-right">Stock</th>
                  <th>IVA</th>
                  <th className="text-center w-20">Acc.</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(product => {
                  const mg = product.cost > 0 && product.price > 0 ? ((product.price - product.cost) / product.price * 100) : 0;
                  return (
                    <tr key={product.id} className="border-t hover:bg-muted/30 cursor-pointer" onDoubleClick={() => openEdit(product)}>
                      <td className="p-2">{product.image ? <img src={product.image} alt="" crossOrigin="anonymous" className="w-7 h-7 rounded object-cover" /> : <span className="text-base">{product.icon || ''}</span>}</td>
                      <td className="p-2">
                        <div className="font-medium whitespace-normal min-w-[200px]">{product.name}
                          <div className="flex gap-1 mt-0.5">
                            {product.noStock && <Badge variant="secondary" className="text-[7px] px-1 py-0">S/Stock</Badge>}
                            {product.isCombo && <Badge variant="outline" className="text-[7px] px-1 py-0 text-orange-600">KIT</Badge>}
                            {product.unitsPerBox > 0 && <Badge variant="outline" className="text-[7px] px-1 py-0 text-purple-600">x{product.unitsPerBox}</Badge>}
                            {product.vendePorPeso && <Badge variant="outline" className="text-[7px] px-1 py-0 text-emerald-600">{product.unidadPeso || 'kg'}</Badge>}

                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-muted-foreground">
                        <div className="truncate max-w-[100px]">{product.brand?.name || '-'}</div>
                        <div className="truncate max-w-[100px] text-[10px]">{product.category?.name || ''}</div>
                      </td>
                      <td className="p-2 text-right font-bold text-green-600">{product.price.toFixed(2)}</td>
                      <td className="p-2 text-right text-muted-foreground">{(product.price * bcvRate).toFixed(2)}</td>
                      <td className="p-2 text-right">{product.cost.toFixed(2)}</td>
                      <td className="p-2 text-right">{product.cost > 0 ? <span className={`font-medium ${mg >= 30 ? 'text-green-600' : mg >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{mg.toFixed(0)}%</span> : <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-2 text-right"><Badge variant={product.stock > (product.minStock || 5) ? "secondary" : "destructive"} className="text-[10px]">{product.stock}</Badge></td>
                      <td className="p-2"><TaxBadge taxType={product.taxType} taxRate={taxRate} /></td>
                      <td className="p-2 text-center"><div className="flex gap-0.5 justify-center"><Button variant="ghost" size="sm" onClick={() => openEdit(product)} className="h-6 text-[10px]">Edit</Button><Button variant="ghost" size="sm" onClick={() => deleteProduct(product.id)} className="h-6 text-[10px] text-destructive">X</Button></div></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={10} className="text-center p-8 text-muted-foreground">No se encontraron productos</td></tr>}
                {totalPages > 1 && (
                  <tr><td colSpan={10} className="p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{filtered.length} productos - Pagina {page} de {totalPages}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                        {Array.from({length: totalPages}, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages).map((p, i, arr) => (
                          <Fragment key={p}>
                            {i > 0 && arr[i-1] !== p - 1 && <span className="text-xs text-muted-foreground px-1">...</span>}
                            <Button variant={p === page ? "default" : "outline"} size="sm" className="h-7 w-7 text-xs p-0" onClick={() => setPage(p)}>{p}</Button>
                          </Fragment>
                        ))}
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                      </div>
                    </div>
                  </td></tr>
                )}
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
              <div className="grid grid-cols-4 gap-2">
                <div><Label className="text-xs">Marca</Label><Select value={formData.brandId} onChange={e => setFormData({ ...formData, brandId: (e.target as any).value })}><option value="">Sin marca</option>{effectiveBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
                <div><Label className="text-xs">Cod. Barras</Label><Input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="EAN/UPC" className="text-sm font-mono" /></div>
                <div><Label className="text-xs">Cod. Secundario</Label><Input value={formData.secondaryBarcode} onChange={e => setFormData({ ...formData, secondaryBarcode: e.target.value })} placeholder="Opcional" className="text-sm font-mono" /></div>
                <div className="flex items-end gap-1"><Button type="button" variant="outline" size="sm" className="text-[10px] flex-1" onClick={() => setShowBrandDialog(true)}>Marcas</Button><Button type="button" variant="outline" size="sm" className="text-[10px] flex-1" onClick={() => setShowCategoryDialog(true)}>Cat.</Button></div>
              </div>
              <div><Label className="text-xs">Descripcion</Label><Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Opcional" className="text-sm" /></div>
            </Block>

            {/* BLOCK 2: IVA + COMO AGREGAS INVENTARIO + PRECIOS */}
            <Block title="IVA, Inventario y Precios" icon="🏛️" defaultOpen={true}>
              {/* Toggle: Como agregas el producto al inventario */}
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Label className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2 block">Como agregas este producto al inventario?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormData(f => ({ ...f, stockMode: 'unit' }))}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${formData.stockMode === 'unit' ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                    <div className="text-xl mb-1">📦</div>
                    <div className="font-semibold text-sm">Por Unidades</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">Conteo unitario. Ej: 10 latas, 5 botellas</div>
                  </button>
                  <button type="button" onClick={() => setFormData(f => ({ ...f, stockMode: 'box' }))}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${formData.stockMode === 'box' ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                    <div className="text-xl mb-1">📋</div>
                    <div className="font-semibold text-sm">Por Bulto / Caja</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">Compra por bulto. Ej: 5 cajas x 24 uds</div>
                  </button>
                </div>
              </div>

              {/* IVA */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <Label className="text-xs">Tipo IVA (SENIAT)</Label>
                  <Select value={formData.taxType} onChange={e => setFormData({ ...formData, taxType: (e.target as any).value })}>
                    <option value="general">Gravado (usa IVA configurado)</option>
                    <option value="exento">Exento (0%)</option>
                    <option value="omitido">Omitido</option>
                  </Select>
                  <p className="text-[8px] text-muted-foreground mt-0.5">El % de IVA se configura globalmente</p>
                </div>
                <div>
                  <Label className="text-xs">Stock Minimo (alerta)</Label>
                  <Input type="number" min="0" value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: e.target.value })} placeholder="5" className="text-sm" />
                </div>
              </div>

              {/* ── MODO POR UNIDADES ── */}
              {formData.stockMode !== 'box' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Costo Unitario ({currency})</Label>
                      <Input type="number" step="0.01" min="0" value={formData.cost} onChange={e => { const c = e.target.value, nf = { ...formData, cost: c }; if (c && formData.marginPercent) nf.price = calcPrice(c, formData.marginPercent); setFormData(nf); }} placeholder="0.00" className="text-sm font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs">Margen Ganancia %</Label>
                      <Input type="number" step="0.1" value={formData.marginPercent} onChange={e => { const m = e.target.value, nf = { ...formData, marginPercent: m }; if (formData.cost && m) nf.price = calcPrice(formData.cost, m); setFormData(nf); }} placeholder="35" className="text-sm font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs">Precio Venta ({currency})</Label>
                      <Input type="number" step="0.01" min="0" value={autoPrice || formData.price} onChange={e => { const p = e.target.value, nf = { ...formData, price: p }; if (p && formData.cost) nf.marginPercent = calcMargin(p, formData.cost); setFormData(nf); }} className="text-sm font-mono font-bold text-green-600" />
                      {autoPrice && <p className="text-[8px] text-blue-600">Auto-calculado</p>}
                    </div>
                    <div>
                      <Label className="text-xs">Cantidad (Stock)</Label>
                      <Input type="number" min="0" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="0" className="text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mb-1"><span>Margen real</span><span className={`font-bold ${parseFloat(autoMargin) >= 30 ? 'text-green-600' : parseFloat(autoMargin) >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{autoMargin}%</span></div>
                      <MarginBar margin={parseFloat(autoMargin) || 0} />
                    </div>
                    <div className="text-right">
                      {formData.price && bcvRate > 0 && <p className="text-xs text-green-700 font-medium">Bs {(parseFloat(formData.price) * bcvRate).toFixed(2)}</p>}
                      {autoPrice && <p className="text-[9px] text-blue-600">Precio sugerido: {currency} {autoPrice}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── MODO POR BULTO ── */}
              {formData.stockMode === 'box' && (
                <div className="space-y-2">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded text-[10px] text-amber-800 dark:text-amber-200 mb-1">
                    <strong>Modo Bulto:</strong> Ingrese los datos de la compra por bulto. El sistema calcula automaticamente el precio de venta por unidad.
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Bultos Comprados</Label>
                      <Input type="number" min="1" value={formData.boxQty} onChange={e => setFormData({ ...formData, boxQty: e.target.value })} placeholder="Ej: 5" className="text-sm font-mono" />
                      <p className="text-[8px] text-muted-foreground">Cuantas cajas/bultos compro</p>
                    </div>
                    <div>
                      <Label className="text-xs">Uds por Bulto</Label>
                      <Input type="number" min="1" value={formData.unitsPerBox} onChange={e => setFormData({ ...formData, unitsPerBox: e.target.value })} placeholder="Ej: 24" className="text-sm font-mono" />
                      <p className="text-[8px] text-muted-foreground">Unidades dentro de 1 bulto</p>
                    </div>
                    <div>
                      <Label className="text-xs">Costo del Bulto ({currency})</Label>
                      <Input type="number" step="0.01" min="0" value={formData.boxPrice} onChange={e => setFormData({ ...formData, boxPrice: e.target.value })} placeholder="Ej: 10.00" className="text-sm font-mono" />
                      <p className="text-[8px] text-muted-foreground">Lo que pagaste por 1 bulto</p>
                    </div>
                    <div>
                      <Label className="text-xs">Margen Ganancia %</Label>
                      <Input type="number" step="0.1" value={formData.boxMarginPercent} onChange={e => setFormData({ ...formData, boxMarginPercent: e.target.value })} placeholder="20" className="text-sm font-mono" />
                      <p className="text-[8px] text-muted-foreground">Ganancia deseada</p>
                    </div>
                  </div>

                  {/* Resumen automatico bulto */}
                  <div className={`grid grid-cols-4 gap-2 p-2 rounded-lg border ${boxPricePerUnit > 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50'}`}>
                    <div className="text-center">
                      <p className="text-[8px] text-muted-foreground uppercase">Costo por Unidad</p>
                      <p className="text-sm font-bold font-mono">{boxCostPerUnit > 0 ? `${currency} ${boxCostPerUnit.toFixed(4)}` : '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-muted-foreground uppercase">Precio Venta Ud</p>
                      <p className={`text-sm font-bold font-mono ${boxPricePerUnit > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>{boxPricePerUnit > 0 ? `${currency} ${boxPricePerUnit.toFixed(2)}` : '—'}</p>
                      {boxPricePerUnit > 0 && <p className="text-[7px] text-green-600">Auto-calculado</p>}
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-muted-foreground uppercase">Stock Total</p>
                      <p className="text-sm font-bold font-mono">{boxTotalStock > 0 ? `${boxTotalStock} uds` : '—'}</p>
                      {boxTotalStock > 0 && <p className="text-[7px] text-muted-foreground">{boxQtyBought} bulto(s) x {boxUnitsPerBox}</p>}
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-muted-foreground uppercase">Inversion Total</p>
                      <p className="text-sm font-bold font-mono">{boxQtyBought > 0 && boxCostPerBox > 0 ? `${currency} ${(boxQtyBought * boxCostPerBox).toFixed(2)}` : '—'}</p>
                    </div>
                  </div>

                  {/* Boton para aplicar los valores calculados al producto */}
                  {boxPricePerUnit > 0 && (
                    <button type="button" onClick={() => {
                      setFormData(f => ({
                        ...f,
                        cost: boxCostPerUnit.toString(),
                        price: boxPricePerUnit.toString(),
                        marginPercent: boxMarginPct.toString(),
                        stock: boxTotalStock.toString(),
                      }));
                      toast.success(`Aplicado: Costo ${currency} ${boxCostPerUnit.toFixed(4)} / Precio ${currency} ${boxPricePerUnit.toFixed(2)} / Stock ${boxTotalStock} uds`);
                    }}
                    className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                      <span>✅</span> Aplicar al Producto: Vender a {currency} {boxPricePerUnit.toFixed(2)} c/u (Stock: {boxTotalStock} uds)
                    </button>
                  )}

                  {boxPricePerUnit <= 0 && boxCostPerBox > 0 && (
                    <p className="text-[10px] text-amber-600 bg-amber-50 rounded p-2">Coloca el margen de ganancia para ver el precio de venta sugerido.</p>
                  )}
                </div>
              )}

              {/* Precio Mayorista (misma logica que detal: costo + % ganancia = precio sugerido) */}
              <div className="mt-2 pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">💰 Precio al Mayor</span>
                  <span className="text-[9px] text-muted-foreground">Igual que Detal: Costo + % Ganancia = Precio Sugerido</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">Costo Mayor ({currency})</Label>
                    <Input type="number" step="0.01" min="0" value={formData.wholesaleCost} onChange={e => { const c = e.target.value, nf = { ...formData, wholesaleCost: c }; if (c && formData.wholesaleMarginPercent) nf.wholesalePrice = calcPrice(c, formData.wholesaleMarginPercent); setFormData(nf); }} placeholder="0.00" className="text-sm font-mono" />
                    <p className="text-[8px] text-muted-foreground">Costo al que compras al mayor</p>
                  </div>
                  <div>
                    <Label className="text-[10px]">Margen Ganancia %</Label>
                    <Input type="number" step="0.1" value={formData.wholesaleMarginPercent} onChange={e => { const m = e.target.value, nf = { ...formData, wholesaleMarginPercent: m }; if (formData.wholesaleCost && m) nf.wholesalePrice = calcPrice(formData.wholesaleCost, m); setFormData(nf); }} placeholder="20" className="text-sm font-mono" />
                    <p className="text-[8px] text-muted-foreground">Ganancia deseada al mayor</p>
                  </div>
                  <div>
                    <Label className="text-[10px]">P. Mayorista ({currency})</Label>
                    <Input type="number" step="0.01" min="0" value={autoWholesalePrice || formData.wholesalePrice} onChange={e => { const p = e.target.value, nf = { ...formData, wholesalePrice: p }; if (p && formData.wholesaleCost) nf.wholesaleMarginPercent = calcMargin(p, formData.wholesaleCost); setFormData(nf); }} className="text-sm font-mono font-bold text-orange-600" />
                    {autoWholesalePrice && <p className="text-[8px] text-blue-600">Auto-calculado</p>}
                  </div>
                  <div>
                    <Label className="text-[10px]">Cant. Min. Mayorista</Label>
                    <Input type="number" min="0" value={formData.minWholesaleQty} onChange={e => setFormData({ ...formData, minWholesaleQty: e.target.value })} className="text-sm" />
                    <p className="text-[8px] text-muted-foreground">A partir de cuantas uds aplica</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mb-1"><span>Margen real mayor</span><span className={`font-bold ${parseFloat(autoWholesaleMargin) >= 30 ? 'text-green-600' : parseFloat(autoWholesaleMargin) >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{autoWholesaleMargin}%</span></div>
                    <MarginBar margin={parseFloat(autoWholesaleMargin) || 0} />
                  </div>
                  <div className="text-right">
                    {formData.wholesalePrice && bcvRate > 0 && <p className="text-xs text-orange-700 font-medium">Bs {(parseFloat(formData.wholesalePrice) * bcvRate).toFixed(2)}</p>}
                    {autoWholesalePrice && <p className="text-[9px] text-blue-600">Precio sugerido mayor: {currency} {autoWholesalePrice}</p>}
                  </div>
                </div>
              </div>

              {/* Gran Mayor (GM) */}
              <div className="mt-2 pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="isGranMayor"
                    checked={!!formData.isGranMayor}
                    onChange={e => {
                      const isGM = e.target.checked;
                      let gmPrice = formData.granMayorPrice;
                      if (isGM) {
                        const price = parseFloat(formData.price) || 0;
                        const bcv = bcvRate || 0;
                        const euro = euroUsdtRate || 0;
                        if (price > 0 && bcv > 0 && euro > 0) {
                          gmPrice = (Math.round(price * (euro / bcv) * 10000) / 10000).toString();
                        } else {
                          toast.error("Configure las tasas BCV y Euro/USDT en Configuracion primero");
                          return;
                        }
                      } else {
                        gmPrice = "0";
                      }
                      setFormData({ ...formData, isGranMayor: isGM, granMayorPrice: gmPrice });
                    }}
                    className="rounded"
                  />
                  <Label htmlFor="isGranMayor" className="text-xs font-medium cursor-pointer">Gran Mayor (GM)</Label>
                  <span className="text-[9px] text-muted-foreground ml-1">Precio basado en tasa Euro/USDT</span>
                </div>
                {formData.isGranMayor && (
                  <div className="ml-6">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">P. Gran Mayor ({currency})</Label>
                        <Input type="number" step="0.01" min="0" value={formData.granMayorPrice} onChange={e => setFormData({ ...formData, granMayorPrice: e.target.value })} className="text-sm" placeholder="0" />
                        <p className="text-[8px] text-muted-foreground">Se recalcula al activar con las tasas actuales</p>
                      </div>
                      <div className="flex items-end pb-1">
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                          <p>Factor: {bcvRate > 0 && euroUsdtRate > 0 ? `x${(euroUsdtRate / bcvRate).toFixed(3)}` : '-'}</p>
                          <p>BCV: {bcvRate} | Euro: {euroUsdtRate}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Block>

            {/* BLOCK 4: FOTO + CODIGOS */}
            <Block title="Foto y Codigos de Barras" icon="📸" defaultOpen={false}>
              <div className="flex items-start gap-3">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                  {formData.image ? <img src={formData.image} alt="Producto" crossOrigin="anonymous" className="w-full h-full object-cover" /> : <span className="text-2xl text-gray-300">📷</span>}
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex gap-2">
                    <input type="file" ref={camRef} accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const url = URL.createObjectURL(f); setCropImageSrc(url); setShowCrop(true); } e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" className="text-[10px]" onClick={() => camRef.current?.click()} disabled={uploading}>{uploading ? "..." : "📷 Tomar Foto"}</Button>
                    <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const url = URL.createObjectURL(f); setCropImageSrc(url); setShowCrop(true); } e.target.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" className="text-[10px]" onClick={() => fileRef.current?.click()} disabled={uploading}>📁 Galeria</Button>
                    {formData.image && <Button type="button" variant="outline" size="sm" className="text-[10px] text-red-500" onClick={() => setFormData(p => ({ ...p, image: "" }))}>X</Button>}
                  </div>
                  <p className="text-[9px] text-muted-foreground">Tome la foto y recortela para enfocar solo el producto.</p>
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

      {/* BRANDS DIALOG */}
      <Dialog open={showBrandDialog} onOpenChange={setShowBrandDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Nueva marca" onKeyDown={e => e.key === "Enter" && createBrand()} className="flex-1" />
              <Button onClick={createBrand}>+</Button>
            </div>
            <Separator />
            <div className="text-[10px] text-muted-foreground">Las marcas no distinguen mayusculas/minusculas (HP = hp)</div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {effectiveBrands.map(b => <div key={b.id} className="flex items-center justify-between p-2 rounded hover:bg-muted"><span className="text-sm">{b.name} <span className="text-muted-foreground text-xs">({b._count?.products || 0})</span></span><Button variant="ghost" size="sm" onClick={() => deleteBrand(b.id)} className="text-destructive text-xs h-7">X</Button></div>)}
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

      {/* STOCK ADJUSTMENT DIALOG (KARDEX) */}
      <Dialog open={showStockAdjustDialog} onOpenChange={o => { if (!o) { setShowStockAdjustDialog(false); setStockAdjustReason(""); setStockAdjustData(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Ajuste de Inventario
            </DialogTitle>
          </DialogHeader>
          {stockAdjustData && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Se detectó un cambio en el stock del producto:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Producto:</span>
                    <p className="font-medium">{stockAdjustData.productName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Variación:</span>
                    <p className={`font-bold ${stockAdjustData.newStock > stockAdjustData.oldStock ? 'text-green-600' : 'text-red-600'}`}>
                      {stockAdjustData.newStock > stockAdjustData.oldStock ? '+' : ''}{stockAdjustData.newStock - stockAdjustData.oldStock} uds
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stock anterior:</span>
                    <p className="font-medium">{stockAdjustData.oldStock} uds</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nuevo stock:</span>
                    <p className="font-medium">{stockAdjustData.newStock} uds</p>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-red-600">Motivo del ajuste *</Label>
                <textarea
                  className="w-full mt-1 min-h-[80px] p-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 dark:bg-gray-800"
                  placeholder="Describa el motivo por el cual se modifica el inventario (ej: conteo físico, merma, ajuste por error, etc.)"
                  value={stockAdjustReason}
                  onChange={e => setStockAdjustReason(e.target.value)}
                />
                <p className="text-[9px] text-muted-foreground mt-1">Este motivo quedará registrado en el Kardex de inventario junto con el nombre del usuario.</p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded text-[10px] text-blue-700 dark:text-blue-300">
                Se generará un registro en el <strong>Kardex de Inventario</strong> documenting este ajuste con el usuario, fecha, motivo y variación de stock.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowStockAdjustDialog(false); setStockAdjustReason(""); setStockAdjustData(null); }} disabled={stockAdjustSaving}>Cancelar</Button>
                <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={confirmStockAdjust} disabled={stockAdjustSaving || !stockAdjustReason.trim()}>
                  {stockAdjustSaving ? "Registrando..." : "Confirmar Ajuste"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de recorte de imagen */}
      <CropDialog
        open={showCrop}
        imageSrc={cropImageSrc}
        onCropComplete={(blob) => {
          setShowCrop(false);
          URL.revokeObjectURL(cropImageSrc);
          const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });
          uploadImage(file);
        }}
        onCancel={() => {
          setShowCrop(false);
          URL.revokeObjectURL(cropImageSrc);
        }}
      />
    </div>
  );
}
