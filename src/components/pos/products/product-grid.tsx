"use client";

import { Badge } from "@/components/ui/badge";
import type { Product } from "../types";

interface ProductGridProps {
  products: Product[];
  currency: string;
  bcvRate: number;
  allowZeroStock: boolean;
  onAddToCart: (product: Product) => void;
}

// Genera URL con parámetro thumb para cargar versión pequeña
function getThumbUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  const sep = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${sep}thumb=true`;
}

// Componente de imagen optimizada: lazy load + placeholder + fallback
function ProductImage({ src, alt, icon }: { src: string; alt: string; icon?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center relative">
      {/* Placeholder gris mientras carga */}
      <div className="absolute inset-0 bg-muted animate-pulse rounded-lg" />
      <img
        src={getThumbUrl(src)}
        alt={alt}
        crossOrigin="anonymous"
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover relative z-[1]"
        style={{ minHeight: '48px', minWidth: '48px' }}
        onLoad={(e) => {
          // Ocultar placeholder cuando la imagen carga
          const placeholder = (e.target as HTMLImageElement).previousElementSibling;
          if (placeholder) (placeholder as HTMLElement).style.display = 'none';
        }}
        onError={(e) => {
          // Ocultar placeholder e imagen, mostrar icono fallback
          const img = e.target as HTMLImageElement;
          const placeholder = img.previousElementSibling;
          if (placeholder) (placeholder as HTMLElement).style.display = 'none';
          img.style.display = 'none';
          const fallback = img.nextElementSibling;
          if (fallback) (fallback as HTMLElement).classList.remove('hidden');
        }}
      />
      {/* Fallback: emoji o icono */}
      {icon ? (
        <span className="hidden text-2xl z-[2]">{icon}</span>
      ) : (
        <span className="hidden text-2xl text-muted-foreground z-[2]">📦</span>
      )}
    </div>
  );
}

export function ProductGrid({ products, currency, bcvRate, allowZeroStock, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return <div className="col-span-full text-center text-muted-foreground py-8 text-sm">No se encontraron productos</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 overflow-y-auto max-h-[72vh] p-0.5">
      {products.map((product) => {
        const isOut = product.stock <= 0;
        const isLow = product.stock > 0 && product.stock <= (product.minStock || 5);

        return (
          <button
            key={product.id}
            onClick={() => onAddToCart(product)}
            disabled={!allowZeroStock && isOut}
            className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-center ${
              isOut && !allowZeroStock
                ? "bg-red-50 border-red-300 opacity-50 cursor-not-allowed"
                : isOut && allowZeroStock
                ? "bg-orange-50 border-orange-300"
                : isLow
                ? "bg-yellow-50 border-yellow-300"
                : "bg-card border-muted hover:bg-accent hover:border-primary/40 hover:shadow-sm"
            }`}
          >
            {/* Image or icon */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
              {product.image ? (
                <ProductImage src={product.image} alt={product.name} icon={product.icon} />
              ) : product.icon ? (
                <span className="text-2xl">{product.icon}</span>
              ) : (
                <span className="text-2xl text-muted-foreground">📦</span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-tight block truncate w-full">{product.name}</span>
            <span className="text-xs font-bold text-primary">
              {currency} {product.price.toFixed(2)}{product.vendePorPeso && product.unidadPeso ? `/${product.unidadPeso}` : ""}
            </span>
            <span className="text-[9px] text-muted-foreground">Bs {(product.price * bcvRate).toFixed(0)}</span>
            <Badge variant={isOut ? "destructive" : isLow ? "warning" : "secondary"} className="text-[9px] px-1.5 py-0">
              {product.stock}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
