"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

interface CatalogTabProps {
  bcvRate: number;
  currency: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeRif: string;
  storeLogo: string;
  theme: string;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  _count?: { products: number };
}

interface Brand {
  id: string;
  name: string;
  _count?: { products: number };
}

export default function CatalogTab({
  bcvRate, currency, storeName, storeAddress, storePhone, storeRif, storeLogo, theme,
}: CatalogTabProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  const [selectedColor, setSelectedColor] = useState("");
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showPriceUsd, setShowPriceUsd] = useState(true);
  const [showPriceBs, setShowPriceBs] = useState(true);
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [selectedView, setSelectedView] = useState("grid");
  const [cardSize, setCardSize] = useState("medium");
  const [showDescription, setShowDescription] = useState(true);
  const [showStock, setShowStock] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [selectedBg, setSelectedBg] = useState("solid");
  const [customBgColor1, setCustomBgColor1] = useState("");
  const [customBgColor2, setCustomBgColor2] = useState("");
  const [coverLogoUrl, setCoverLogoUrl] = useState(storeLogo || "");
  const coverLogoInputRef = useRef<HTMLInputElement>(null);

  // Sync coverLogoUrl with storeLogo when storeLogo changes
  useEffect(() => {
    if (storeLogo && !coverLogoUrl) {
      setCoverLogoUrl(storeLogo);
    }
  }, [storeLogo]);

  const handleCoverLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast.error("Imagen demasiado grande. Maximo 512KB");
      return;
    }
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no soportado. Use PNG, JPG, GIF o WEBP");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await authFetch('/api/store-logo', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setCoverLogoUrl(data.url);
        toast.success("Logo del catalogo cargado");
      } else {
        toast.error(data.error || "Error al subir logo");
      }
    } catch (err) {
      toast.error("Error de conexion al subir logo");
    }
    if (coverLogoInputRef.current) coverLogoInputRef.current.value = '';
  }, []);

  const templates = [
    { id: "modern", label: "Moderno", desc: "Gradientes y sombras", color: "#2563eb" },
    { id: "elegant", label: "Elegante", desc: "Tono purpura sofisticado", color: "#7c3aed" },
    { id: "minimal", label: "Minimalista", desc: "Limpio y simple", color: "#0d9488" },
    { id: "dark", label: "Oscuro", desc: "Modo oscuro premium", color: "#1e293b" },
    { id: "neon", label: "Neon", desc: "Colores vibrantes", color: "#22c55e" },
    { id: "classic", label: "Clasico", desc: "Estilo tradicional", color: "#ea580c" },
    { id: "magazine", label: "Revista", desc: "Estilo editorial", color: "#db2777" },
    { id: "gradient", label: "Degrade", desc: "Gradiente multiple", color: "#6366f1" },
  ];
  const colorPresets = [
    { id: "", label: "Auto", color: "#6366f1" },
    { id: "#2563eb", label: "Azul", color: "#2563eb" },
    { id: "#059669", label: "Verde", color: "#059669" },
    { id: "#7c3aed", label: "Morado", color: "#7c3aed" },
    { id: "#dc2626", label: "Rojo", color: "#dc2626" },
    { id: "#ea580c", label: "Naranja", color: "#ea580c" },
    { id: "#db2777", label: "Rosa", color: "#db2777" },
    { id: "#d97706", label: "Dorado", color: "#d97706" },
    { id: "#0891b2", label: "Cyan", color: "#0891b2" },
    { id: "#4f46e5", label: "Indigo", color: "#4f46e5" },
    { id: "#be185d", label: "Fucsia", color: "#be185d" },
    { id: "#15803d", label: "Esmeralda", color: "#15803d" },
  ];
  const fontOptions = [
    { id: "Inter", label: "Inter", desc: "Moderna y legible" },
    { id: "Roboto", label: "Roboto", desc: "Google standard" },
    { id: "Poppins", label: "Poppins", desc: "Redondeada y amigable" },
    { id: "Montserrat", label: "Montserrat", desc: "Elegante y profesional" },
    { id: "Open Sans", label: "Open Sans", desc: "Limpia y neutral" },
    { id: "Lato", label: "Lato", desc: "Suave y clara" },
    { id: "Playfair Display", label: "Playfair", desc: "Serif sofisticada" },
    { id: "Oswald", label: "Oswald", desc: "Compacta y bold" },
  ];
  const viewOptions = [
    { id: "grid", label: "Cuadricula", icon: "▦" },
    { id: "list", label: "Lista", icon: "☰" },
    { id: "compact", label: "Compacto", icon: "▫" },
    { id: "large", label: "Tarjetas grandes", icon: "▥" },
  ];
  const cardSizeOptions = [
    { id: "small", label: "Peque\u00f1as" },
    { id: "medium", label: "Medianas" },
    { id: "large", label: "Grandes" },
  ];
  const bgOptions = [
    { id: "solid", label: "Solido", desc: "Color unico" },
    { id: "gradient", label: "Degrade", desc: "Dos colores" },
    { id: "radial", label: "Radial", desc: "Circular" },
    { id: "pattern", label: "Patron", desc: "Repetitivo" },
    { id: "geometric", label: "Geometrico", desc: "Formas" },
    { id: "waves", label: "Ondas", desc: "Suaves" },
  ];

  const loadData = useCallback(async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        authFetch("/api/categories"),
        authFetch("/api/brands"),
      ]);
      if (catRes.ok) { const d = await catRes.json(); if (Array.isArray(d)) setCategories(d); }
      if (brandRes.ok) { const d = await brandRes.json(); if (Array.isArray(d)) setBrands(d); }
    } catch { /* silently ignore */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id); // Max 5 categories
      else toast.warning("Maximo 5 categorias seleccionadas");
      return next;
    });
  };

  const clearCategories = () => setSelectedCategories(new Set());

  const buildParams = () => {
    const params = new URLSearchParams();
    if (selectedCategories.size > 0) {
      params.set("categories", Array.from(selectedCategories).join(","));
    }
    if (selectedBrand !== "all") params.set("brand", selectedBrand);
    if (selectedTemplate) params.set("template", selectedTemplate);
    if (selectedColor) params.set("color", selectedColor);
    if (hideUnavailable) params.set("hideUnavailable", "true");
    if (!showPriceUsd) params.set("hidePriceUsd", "true");
    if (!showPriceBs) params.set("hidePriceBs", "true");
    if (selectedFont) params.set("font", selectedFont);
    if (selectedView) params.set("view", selectedView);
    if (cardSize) params.set("cardSize", cardSize);
    if (!showDescription) params.set("hideDescription", "true");
    if (!showStock) params.set("hideStock", "true");
    if (!showBrand) params.set("hideBrand", "true");
    if (selectedBg) params.set("bgStyle", selectedBg);
    if (customBgColor1) params.set("bgColor1", customBgColor1);
    if (customBgColor2) params.set("bgColor2", customBgColor2);
    if (coverLogoUrl) params.set("coverLogo", coverLogoUrl);
    return params;
  };

  const generateCatalog = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res = await authFetch(`/api/catalog?${params.toString()}`);
      if (!res.ok) throw new Error("Error al generar");

      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      window.open(url, "_blank");
      toast.success("Catalogo generado correctamente");
    } catch (e: any) {
      toast.error(e.message || "Error al generar catalogo");
    } finally {
      setLoading(false);
    }
  };

  const downloadCatalog = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      params.set("format", "html");
      const res = await authFetch(`/api/catalog?${params.toString()}`);
      if (!res.ok) throw new Error("Error al descargar");

      const html = await res.text();
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
      }
      toast.success("Abriendo PDF para imprimir");
    } catch (e: any) {
      toast.error(e.message || "Error al descargar");
    } finally {
      setLoading(false);
    }
  };

  const downloadCatalogHTML = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res = await authFetch(`/api/catalog?${params.toString()}`);
      if (!res.ok) throw new Error("Error al descargar");

      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `catalogo-${storeName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Catalogo descargado como HTML");
    } catch (e: any) {
      toast.error(e.message || "Error al descargar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            📖 Catalogo de Productos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg p-4 text-sm space-y-1">
            <p className="font-semibold text-primary">Genera un catalogo elegante de tus productos</p>
            <p className="text-muted-foreground text-xs">
              Incluye portada con datos de la tienda, imagenes de productos, precios en {currency} y Bs,
              y un codigo QR para que tus clientes te contacten por WhatsApp.
            </p>
          </div>

          {/* Store preview */}
          <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
            {storeLogo ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-card flex items-center justify-center flex-shrink-0">
                <img crossOrigin="anonymous" src={storeLogo} alt="" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-2xl">🏪</div>
            )}
            <div>
              <p className="font-semibold text-sm">{storeName || "Mi Tienda"}</p>
              <p className="text-xs text-muted-foreground">
                {[storeAddress, storePhone, storeRif].filter(Boolean).join(" | ") || "Configura tus datos en Configuracion"}
              </p>
            </div>
          </div>

          {/* Multi-category filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Filtrar por categorias (puedes seleccionar hasta 5)
              </label>
              {selectedCategories.size > 0 && (
                <button onClick={clearCategories} className="text-[10px] text-destructive hover:underline">
                  Limpiar ({selectedCategories.size} seleccionada{selectedCategories.size > 1 ? 's' : ''})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={clearCategories}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedCategories.size === 0
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-muted hover:bg-accent"
                }`}
              >
                Todas
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedCategories.has(cat.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-muted hover:bg-accent"
                  }`}
                >
                  {cat.icon || ""} {cat.name}
                  {cat._count?.products ? (
                    <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0">{cat._count.products}</Badge>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Brand filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por marca (opcional)</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedBrand("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedBrand === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-muted hover:bg-accent"
                }`}
              >
                Todas las marcas
              </button>
              {brands.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBrand(b.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedBrand === b.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-muted hover:bg-accent"
                  }`}
                >
                  {b.name}
                  {b._count?.products ? (
                    <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0">{b._count.products}</Badge>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Price toggles */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Mostrar precios</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-green-800 dark:text-green-300">Precio en {currency}</p>
                  <p className="text-[10px] text-green-600 dark:text-green-400">Dolares</p>
                </div>
                <button
                  onClick={() => setShowPriceUsd(!showPriceUsd)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${showPriceUsd ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${showPriceUsd ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Precio en Bs</p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">Bolivares</p>
                </div>
                <button
                  onClick={() => setShowPriceBs(!showPriceBs)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${showPriceBs ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${showPriceBs ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Hide unavailable toggle */}
          <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Ocultar productos sin disponibilidad</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">No se mostraran productos agotados o con stock en 0</p>
            </div>
            <button
              onClick={() => setHideUnavailable(!hideUnavailable)}
              className={`relative w-11 h-6 rounded-full transition-colors ${hideUnavailable ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${hideUnavailable ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Content toggles */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Contenido de las tarjetas</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <p className="text-[10px] font-medium">Descripcion</p>
                <button
                  onClick={() => setShowDescription(!showDescription)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${showDescription ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${showDescription ? 'translate-x-4' : ''}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <p className="text-[10px] font-medium">Stock</p>
                <button
                  onClick={() => setShowStock(!showStock)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${showStock ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${showStock ? 'translate-x-4' : ''}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <p className="text-[10px] font-medium">Marca</p>
                <button
                  onClick={() => setShowBrand(!showBrand)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${showBrand ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${showBrand ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* View mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tipo de vista</label>
            <div className="grid grid-cols-4 gap-2">
              {viewOptions.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedView(v.id)}
                  className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                    selectedView === v.id
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/30'
                  }`}
                >
                  <span className="text-lg">{v.icon}</span>
                  <p className="text-[10px] font-medium mt-1">{v.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Card size */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tamano de tarjetas</label>
            <div className="grid grid-cols-3 gap-2">
              {cardSizeOptions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setCardSize(s.id)}
                  className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                    cardSize === s.id
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/30'
                  }`}
                >
                  <p className="text-xs font-semibold">{s.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cover logo */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Logo para portada del catalogo</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center flex-shrink-0">
                {coverLogoUrl ? (
                  <img crossOrigin="anonymous" src={coverLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" onError={() => setCoverLogoUrl("")} />
                ) : (
                  <span className="text-2xl text-muted-foreground/50">📷</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input type="text" value={coverLogoUrl} onChange={(e) => setCoverLogoUrl(e.target.value)} placeholder="URL del logo" className="flex-1 px-3 py-1.5 text-xs border rounded-lg bg-background" />
                  <button onClick={() => coverLogoInputRef.current?.click()} className="px-3 py-1.5 text-xs rounded-lg border bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium" title="Subir logo desde tu equipo">Subir</button>
                  <button onClick={() => setCoverLogoUrl(storeLogo || "")} className="px-3 py-1.5 text-xs rounded-lg border bg-muted hover:bg-accent transition-colors" title="Usar logo de la tienda">Tienda</button>
                  <input ref={coverLogoInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleCoverLogoUpload} className="hidden" />
                </div>
                <p className="text-[10px] text-muted-foreground">Pega URL, sube desde tu equipo o usa el logo de la tienda</p>
              </div>
            </div>
          </div>

          {/* Background style */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Fondo del catalogo</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {bgOptions.map(b => (
                <button key={b.id} onClick={() => setSelectedBg(b.id)} className={`p-2.5 rounded-lg border-2 text-center transition-all ${selectedBg === b.id ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30'}`}>
                  <p className="text-xs font-semibold">{b.label}</p>
                  <p className="text-[9px] text-muted-foreground">{b.desc}</p>
                </button>
              ))}
            </div>
            {selectedBg !== "solid" && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Color 1</label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={customBgColor1 || "#2563eb"} onChange={(e) => setCustomBgColor1(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input type="text" value={customBgColor1} onChange={(e) => setCustomBgColor1(e.target.value)} placeholder="#2563eb" className="flex-1 px-2 py-1 text-xs border rounded bg-background" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Color 2</label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={customBgColor2 || "#7c3aed"} onChange={(e) => setCustomBgColor2(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input type="text" value={customBgColor2} onChange={(e) => setCustomBgColor2(e.target.value)} placeholder="#7c3aed" className="flex-1 px-2 py-1 text-xs border rounded bg-background" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Template selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Estilo del catalogo</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedTemplate === t.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/30"
                  }`}
                >
                  <div className="w-full h-3 rounded-full mb-2" style={{ backgroundColor: t.color }} />
                  <p className="text-xs font-semibold">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Color principal</label>
            <div className="flex flex-wrap gap-2 items-center">
              {colorPresets.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedColor(c.id)}
                  className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                    selectedColor === c.id
                      ? "border-primary scale-110 shadow-sm"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                >
                  {selectedColor === c.id && <span className="text-white text-[10px]">✓</span>}
                </button>
              ))}
              <input
                type="color"
                value={selectedColor || "#2563eb"}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-0"
                title="Color personalizado"
              />
              {selectedColor && (
                <button onClick={() => setSelectedColor("")} className="text-[10px] text-muted-foreground hover:text-destructive">Reset</button>
              )}
            </div>
          </div>

          {/* Font selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tipo de letra</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {fontOptions.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFont(f.id)}
                  className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                    selectedFont === f.id
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/30'
                  }`}
                  style={{ fontFamily: f.id.includes(' ') ? `'${f.id}', sans-serif` : `${f.id}, sans-serif` }}
                >
                  <p className="text-xs font-semibold">{f.label}</p>
                  <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={generateCatalog} disabled={loading} className="flex-1">
              {loading ? "Generando..." : "📖 Ver Catalogo"}
            </Button>
            <Button onClick={downloadCatalog} disabled={loading} variant="outline" className="flex-1">
              📄 Imprimir PDF
            </Button>
            <Button onClick={downloadCatalogHTML} disabled={loading} variant="outline" className="flex-1">
              💾 Descargar HTML
            </Button>
          </div>

          {/* Preview iframe */}
          {previewUrl && (
            <div className="border rounded-lg overflow-hidden" style={{ height: "500px" }}>
              <iframe src={previewUrl} title="Vista previa del catalogo" className="w-full h-full border-0" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2">💡 Consejos para un mejor catalogo</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Agrega imagenes reales a tus productos desde el modulo Productos</li>
            <li>Completa la direccion y telefono en Configuracion para la portada</li>
            <li>Selecciona multiples categorias para catalogos por seccion</li>
            <li>Filtra por marca para crear catalogos especificos de una marca</li>
            <li>Activa &quot;Ocultar sin disponibilidad&quot; para no mostrar productos agotados</li>
            <li>El catalogo se abre en el navegador y tambien se puede imprimir (Ctrl+P)</li>
            <li>El archivo HTML descargado se puede compartir por WhatsApp o email</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
