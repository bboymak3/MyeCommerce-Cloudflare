"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
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
  _count?: { products: number };
}

export default function CatalogTab({
  bcvRate, currency, storeName, storeAddress, storePhone, storeRif, storeLogo, theme,
}: CatalogTabProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  const [selectedColor, setSelectedColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const templates = [
    { id: "modern", label: "Moderno", desc: "Gradientes y sombras", color: "#2563eb" },
    { id: "elegant", label: "Elegante", desc: "Tono purpura sofisticado", color: "#7c3aed" },
    { id: "minimal", label: "Minimalista", desc: "Limpio y simple", color: "#0d9488" },
    { id: "dark", label: "Oscuro", desc: "Modo oscuro premium", color: "#1e293b" },
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
  ];

  const loadCategories = useCallback(async () => {
    try {
      const res = await authFetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCategories(data);
      }
    } catch { /* silently ignore */ }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const generateCatalog = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedTemplate) params.set("template", selectedTemplate);
      if (selectedColor) params.set("color", selectedColor);

      const res = await authFetch(`/api/catalog?${params.toString()}`);
      if (!res.ok) throw new Error("Error al generar");

      const html = await res.text();

      // Abrir en nueva ventana
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
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedTemplate) params.set("template", selectedTemplate);
      if (selectedColor) params.set("color", selectedColor);
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
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedTemplate) params.set("template", selectedTemplate);
      if (selectedColor) params.set("color", selectedColor);

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
                <img src={storeLogo} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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

          {/* Category filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por categoria (opcional)</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedCategory === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-muted hover:bg-accent"
                }`}
              >
                Todas
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedCategory === cat.id
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
            <li>Organiza tus productos en categorias para mejor presentacion</li>
            <li>El catalogo se abre en el navegador y tambien se puede imprimir (Ctrl+P)</li>
            <li>El archivo HTML descargado se puede compartir por WhatsApp o email</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
