"use client";

import { Badge } from "@/components/ui/badge";
import type { Product } from "../types";

interface ProductListProps {
  products: Product[];
  currency: string;
  bcvRate: number;
  allowZeroStock: boolean;
  onAddToCart: (product: Product) => void;
}

export function ProductList({ products, currency, bcvRate, allowZeroStock, onAddToCart }: ProductListProps) {
  if (products.length === 0) {
    return <div className="text-center text-muted-foreground py-8 text-sm">No se encontraron productos</div>;
  }

  return (
    <div className="overflow-y-auto max-h-[72vh] p-0.5 space-y-0.5">
      {products.map((product) => {
        const isOut = product.stock <= 0;
        const isLow = product.stock > 0 && product.stock <= (product.minStock || 5);

        return (
          <button
            key={product.id}
            onClick={() => onAddToCart(product)}
            disabled={!allowZeroStock && isOut}
            className={`flex items-center gap-2 w-full p-2 rounded-lg border transition-all text-left ${
              isOut && !allowZeroStock
                ? "bg-red-50 border-red-300 opacity-50 cursor-not-allowed"
                : isOut && allowZeroStock
                ? "bg-orange-50 border-orange-300"
                : isLow
                ? "bg-yellow-50 border-yellow-300"
                : "bg-card border-muted hover:bg-accent hover:border-primary/40"
            }`}
          >
            {product.icon && <span className="text-base flex-shrink-0">{product.icon}</span>}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{product.name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-primary">
                {currency} {product.price.toFixed(2)}{product.vendePorPeso && product.unidadPeso ? `/${product.unidadPeso}` : ""}
              </p>
              <p className="text-[9px] text-muted-foreground">Bs {(product.price * bcvRate).toFixed(0)}</p>
            </div>
            <Badge variant={isOut ? "destructive" : isLow ? "warning" : "secondary"} className="flex-shrink-0 text-[9px] px-1.5 py-0">
              {product.stock}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
