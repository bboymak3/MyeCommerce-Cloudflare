"use client";

import { Button } from "@/components/ui/button";
import type { CartItem, Product } from "../types";

interface CartItemRowProps {
  item: CartItem;
  product: Product | undefined;
  currency: string;
  allowZeroStock: boolean;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onToggleWholesale: (id: string) => void;
}

export function CartItemRow({ item, product, currency, allowZeroStock, onUpdateQty, onRemove, onToggleWholesale }: CartItemRowProps) {
  const isOver = product && !allowZeroStock && item.quantity > product.stock;
  const step = item.vendePorPeso ? 0.1 : 1;

  return (
    <div className={`flex items-center gap-2 p-2 rounded-xl border-2 text-sm ${
      isOver ? "border-red-400 bg-red-50" : item.isWholesale ? "border-emerald-400 bg-emerald-50/50" : "bg-muted/40 border-muted"
    }`}>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-xs">
          {item.name}
          {item.isWholesale && <span className="text-emerald-600 text-[9px] ml-1 font-bold">MAYORISTA</span>}
          {item.vendePorPeso ? <span className="text-orange-600 text-[9px] ml-1">({item.unidadPeso || "kg"})</span> : ""}
        </div>
        <div className="text-muted-foreground text-[11px]">
          {currency} {item.price.toFixed(2)}{item.vendePorPeso ? `/${item.unidadPeso || "kg"}` : ""}
          {item.isWholesale && product && (
            <span className="line-through ml-1 text-red-400 text-[10px]">${(product.price || 0).toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1">
        <button className="w-6 h-6 rounded border flex items-center justify-center hover:bg-accent text-sm font-bold"
          onClick={() => onUpdateQty(item.id, item.quantity - step)}>-</button>
        <input
          type="number" min="0" step={item.vendePorPeso ? "0.01" : "1"}
          value={item.quantity}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) onUpdateQty(item.id, v); }}
          className={`w-12 text-center font-medium bg-transparent border-b border-transparent focus:border-primary text-xs h-6 p-0 ${
            item.vendePorPeso && !item.pesoIngresado ? "border-orange-400 animate-pulse" : ""
          }`}
        />
        <button className="w-6 h-6 rounded border flex items-center justify-center hover:bg-accent text-sm font-bold"
          onClick={() => onUpdateQty(item.id, item.quantity + step)}>+</button>
      </div>

      {/* Total */}
      <div className="text-right w-16 font-bold text-xs">{currency} {item.total.toFixed(2)}</div>

      {/* Actions */}
      <div className="flex flex-col gap-0.5">
        {product && product.wholesalePrice > 0 && (
          <button
            onClick={() => onToggleWholesale(item.id)}
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
              item.isWholesale ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-gray-100 text-gray-500 border-gray-300"
            } hover:opacity-80`}
            title={item.isWholesale ? "Cambiar a precio detal" : "Cambiar a precio mayorista"}
          >
            {item.isWholesale ? "MAYOR" : "DEAL"}
          </button>
        )}
        <button className="text-destructive hover:underline text-lg px-1 leading-none" onClick={() => onRemove(item.id)}>&#10005;</button>
      </div>
    </div>
  );
}
