"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Product } from "../types";
import { ProductGrid } from "./product-grid";
import { ProductList } from "./product-list";

interface ProductPanelProps {
  products: Product[];
  currency: string;
  bcvRate: number;
  allowZeroStock: boolean;
  search: string;
  setSearch: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  selectedBrand: string;
  setSelectedBrand: (v: string) => void;
  onAddToCart: (product: Product) => void;
  onOpenQrModal: () => void;
  onStartScanner: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ProductPanel({
  products, currency, bcvRate, allowZeroStock,
  search, setSearch,
  selectedCategory, setSelectedCategory,
  selectedBrand, setSelectedBrand,
  onAddToCart, onOpenQrModal, onStartScanner, searchInputRef,
}: ProductPanelProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Derive categories & brands from products
  const categories = useMemo(() => [...new Map(
    products.filter((p) => p.category)
      .map((p) => [p.category!.name, { name: p.category!.name, icon: (p.category as any)?.icon || "", color: (p.category as any)?.color || "" }])
  ).values()], [products]);

  const brandsList = useMemo(() => [...new Map(
    products.filter((p) => p.brand)
      .map((p) => [p.brand!.name, { name: p.brand!.name }])
  ).values()], [products]);

  // Filter products
  const filteredProducts = useMemo(() => products.filter((p) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').toLowerCase().includes(search.toLowerCase()) || (p.brand?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchCategory = !selectedCategory || p.category?.name === selectedCategory;
    const matchBrand = !selectedBrand || p.brand?.name === selectedBrand;
    const matchStock = allowZeroStock || p.noStock || p.stock > 0;
    return matchSearch && matchCategory && matchBrand && matchStock;
  }), [products, search, selectedCategory, selectedBrand, allowZeroStock]);

  return (
    <div className="md:col-span-2 flex flex-col gap-2">
      {/* Search bar */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Input ref={searchInputRef} placeholder="Buscar... (F2)" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-20 h-10 text-sm" />
          <div className="absolute right-1 top-1 flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-sm" title="Acceso movil via QR" onClick={onOpenQrModal}>&#128241;</Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-sm" title="Escanear codigo de barras" onClick={onStartScanner}>&#128247;</Button>
          </div>
        </div>

        {/* Category + Brand filters */}
        <div className="flex gap-1.5">
          <Select value={selectedCategory} onChange={(e: any) => setSelectedCategory(e.target.value)} className="h-10 text-sm flex-1">
            <option value="">Todas Cat.</option>
            {categories.map((cat: any) => (
              <option key={cat.name} value={cat.name}>{cat.icon ? cat.icon + " " : ""}{cat.name}</option>
            ))}
          </Select>
          <Select value={selectedBrand} onChange={(e: any) => setSelectedBrand(e.target.value)} className="h-10 text-sm flex-1">
            <option value="">Todas Marcas</option>
            {brandsList.map((br: any) => (
              <option key={br.name} value={br.name}>{br.name}</option>
            ))}
          </Select>
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1">
          <button onClick={() => setViewMode("grid")} className={`flex-1 p-1.5 rounded border text-xs font-medium ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>&#9638; Cuadricula</button>
          <button onClick={() => setViewMode("list")} className={`flex-1 p-1.5 rounded border text-xs font-medium ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>&#9776; Lista</button>
        </div>
      </div>

      {allowZeroStock && (
        <div className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
          Stock libre activado
        </div>
      )}

      {viewMode === "grid" ? (
        <ProductGrid products={filteredProducts} currency={currency} bcvRate={bcvRate} allowZeroStock={allowZeroStock} onAddToCart={onAddToCart} />
      ) : (
        <ProductList products={filteredProducts} currency={currency} bcvRate={bcvRate} allowZeroStock={allowZeroStock} onAddToCart={onAddToCart} />
      )}
    </div>
  );
}
