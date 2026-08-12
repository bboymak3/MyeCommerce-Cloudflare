"use client";

import { useMemo } from "react";
import type { CartItem, Product } from "../types";

interface CalcInput {
  cart: CartItem[];
  taxRate: number;
  taxMode?: string;      // "included" | "added"
  discount: number;
  bcvRate: number;
  maxDiscountPct: number;
  subtotal: number;
}

function getTaxPct(product: CartItem | Product, taxRate: number) {
  const tt = (product as any).taxType || "exento";
  if (tt === "exento" || tt === "omitido") return 0;
  return Math.min(taxRate, 100);
}

export function usePosCalculations({
  cart, taxRate, taxMode = "included", discount, bcvRate, maxDiscountPct, subtotal,
}: CalcInput) {
  // ── IVA total del carrito ─────────────────────────────────────
  const taxAmount = useMemo(() => {
    let tax = 0;
    if (taxMode === "included") {
      for (const item of cart) {
        const tp = getTaxPct(item, taxRate);
        if (tp > 0) tax += item.total * (tp / (100 + tp));
      }
    } else {
      for (const item of cart) {
        const tp = getTaxPct(item, taxRate);
        if (tp > 0) tax += item.total * (tp / 100);
      }
    }
    return tax;
  }, [cart, taxRate, taxMode]);

  // ── Descuento efectivo (respeto maxDiscountPct) ──────────────
  const effectiveDiscount = useMemo(() => {
    const pct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
    return pct > maxDiscountPct ? (subtotal * maxDiscountPct) / 100 : discount;
  }, [discount, subtotal, maxDiscountPct]);

  // ── Total y totalBs ──────────────────────────────────────────
  const total = useMemo(
    () => taxMode === "added" ? subtotal + taxAmount - effectiveDiscount : subtotal - effectiveDiscount,
    [subtotal, taxAmount, effectiveDiscount, taxMode],
  );
  const totalBs = useMemo(() => total * bcvRate, [total, bcvRate]);

  return { taxAmount, effectiveDiscount, total, totalBs };
}
