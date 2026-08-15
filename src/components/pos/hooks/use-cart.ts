"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { Product, CartItem, MixedEntry } from "../types";
import { DEFAULT_MIXED_PAYMENTS } from "../types";

interface UseCartOptions {
  products: Product[];
  allowZeroStock: boolean;
  maxDiscountPct: number;
  bcvRate: number;
  euroUsdtRate: number;
}

export function useCart({ products, allowZeroStock, maxDiscountPct, bcvRate, euroUsdtRate }: UseCartOptions) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [cashReceivedUsd, setCashReceivedUsd] = useState("");
  const [mixedPayments, setMixedPayments] = useState<MixedEntry[]>([...DEFAULT_MIXED_PAYMENTS]);

  // ── GM (Gran Mayor) global mode ──────────────────────────────
  const [isGranMayorMode, setIsGranMayorMode] = useState(false);

  // ── Credit state ───────────────────────────────────────────────
  const [isCredit, setIsCredit] = useState(false);
  const [creditClientId, setCreditClientId] = useState("");
  const [creditClientName, setCreditClientName] = useState("");
  const [creditClientDebt, setCreditClientDebt] = useState(0);
  const [creditDays, setCreditDays] = useState(30);

  // ── Derived ──────────────────────────────────────────────────
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.total, 0), [cart]);

  // ── Mixed payment helpers ─────────────────────────────────────
  const updateMixedEntry = useCallback((index: number, field: keyof MixedEntry, value: string | number) => {
    setMixedPayments((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  }, []);

  const addMixedEntry = useCallback(() => {
    setMixedPayments((prev) => [...prev, { method: "pago-movil", amountBs: 0, amountUsd: 0, reference: "" }]);
  }, []);

  const removeMixedEntry = useCallback((index: number) => {
    setMixedPayments((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  // ── Toggle wholesale ─────────────────────────────────────────
  const toggleWholesale = useCallback(
    (id: string) => {
      const product = products.find((p) => p.id === id);
      if (!product || !product.wholesalePrice || product.wholesalePrice <= 0) {
        toast.error("Este producto no tiene precio mayorista configurado");
        return;
      }
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const ws = !item.isWholesale;
          const price = ws ? product.wholesalePrice : product.price;
          return { ...item, isWholesale: ws, price, total: item.quantity * price };
        }),
      );
    },
    [products],
  );

  // ── Toggle GM (Gran Mayor) global mode ──────────────────────
  const toggleGranMayor = useCallback(() => {
    const newState = !isGranMayorMode;
    if (newState) {
      if (!euroUsdtRate || euroUsdtRate <= 0 || !bcvRate || bcvRate <= 0) {
        toast.error("Configure la tasa Euro/USDT en Configuracion primero");
        return;
      }
    }
    setIsGranMayorMode(newState);
    setCart((prev) =>
      prev.map((item) => {
        if (newState) {
          // Activando GM — calcular precio GM
          // Prioridad: isWholesale (mayorista manual) > GM > detal
          if (item.isWholesale) return item; // No tocar si ya es mayorista
          const product = products.find((p) => p.id === item.id);
          const basePrice = product?.price || item.price;
          const gmPrice = Math.round(basePrice * (euroUsdtRate / bcvRate) * 10000) / 10000;
          return { ...item, price: gmPrice, total: item.quantity * gmPrice };
        } else {
          // Desactivando GM — volver a precio detal
          if (item.isWholesale) return item; // No tocar si es mayorista
          const product = products.find((p) => p.id === item.id);
          const detalPrice = product?.price || 0;
          return { ...item, price: detalPrice, total: item.quantity * detalPrice };
        }
      }),
    );
  }, [isGranMayorMode, euroUsdtRate, bcvRate, products]);

  // ── Add to cart ───────────────────────────────────────────────
  const addToCart = useCallback(
    (product: Product) => {
      // Determine initial price based on GM mode
      let initialPrice = product.price;
      if (isGranMayorMode && euroUsdtRate > 0 && bcvRate > 0) {
        initialPrice = Math.round(product.price * (euroUsdtRate / bcvRate) * 10000) / 10000;
      }
      if (!product.noStock && product.stock > 0 && product.stock <= product.minStock) {
        toast.warning(`Stock bajo: ${product.name} (${product.stock} uds, min: ${product.minStock})`, {
          description: "Considerar reabastecer este producto",
          duration: 4000,
        });
      }
      if (product.vendePorPeso) {
        setCart((prev) => {
          if (prev.find((i) => i.id === product.id)) {
            toast.error("Producto ya esta en el carrito. Modifique el peso ahi.");
            return prev;
          }
          if (!allowZeroStock && !product.noStock && product.stock <= 0) {
            toast.error("Producto sin stock");
            return prev;
          }
          return [...prev, { ...product, quantity: 0, total: 0, isWholesale: false, pesoIngresado: false, price: initialPrice }];
        });
        return;
      }
      setCart((prev) => {
        const existing = prev.find((i) => i.id === product.id);
        if (existing) {
          const qty = existing.quantity + 1;
          if (!allowZeroStock && !product.noStock && qty > product.stock) {
            toast.error("Stock insuficiente");
            return prev;
          }
          const price = existing.isWholesale ? product.wholesalePrice || product.price : (isGranMayorMode ? initialPrice : product.price);
          return prev.map((i) => (i.id === product.id ? { ...i, quantity: qty, price, total: qty * price } : i));
        }
        if (!allowZeroStock && !product.noStock && product.stock <= 0) {
          toast.error("Producto sin stock");
          return prev;
        }
        return [...prev, { ...product, quantity: 1, total: initialPrice, isWholesale: false, price: initialPrice }];
      });
    },
    [allowZeroStock, isGranMayorMode, euroUsdtRate, bcvRate],
  );

  // ── Update quantity ───────────────────────────────────────────
  const updateQuantity = useCallback(
    (id: string, qty: number) => {
      const item = cart.find((i) => i.id === id);
      if (item?.vendePorPeso) {
        if (qty <= 0) { removeFromCart(id); return; }
        const product = products.find((p) => p.id === id);
        if (product && !allowZeroStock && !product.noStock && qty > product.stock) {
          toast.error("Stock insuficiente");
          return;
        }
        setCart((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, quantity: qty, total: parseFloat((qty * it.price).toFixed(2)), pesoIngresado: qty > 0 } : it,
          ),
        );
      } else {
        if (qty < 1) { removeFromCart(id); return; }
        const product = products.find((p) => p.id === id);
        if (product && !allowZeroStock && !product.noStock && qty > product.stock) {
          toast.error("Stock insuficiente");
          return;
        }
        const price = item?.isWholesale ? product?.wholesalePrice || product?.price || 0 : product?.price || 0;
        setCart((prev) => prev.map((it) => (it.id === id ? { ...it, quantity: qty, price, total: qty * price } : it)));
      }
    },
    [cart, products, allowZeroStock],
  );

  // ── Remove / Clear ────────────────────────────────────────────
  const removeFromCart = useCallback((id: string) => setCart((prev) => prev.filter((i) => i.id !== id)), []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscount(0);
    setNotes("");
    setReferenceNumber("");
    setCashReceived("");
    setCashReceivedUsd("");
    setMixedPayments([...DEFAULT_MIXED_PAYMENTS]);
    setPaymentMethod("efectivo");
    setIsCredit(false);
    setCreditClientId("");
    setCreditClientName("");
    setCreditClientDebt(0);
    setCreditDays(30);
  }, []);

  return {
    cart, setCart, subtotal, discount, setDiscount, notes, setNotes,
    paymentMethod, setPaymentMethod, referenceNumber, setReferenceNumber,
    cashReceived, setCashReceived, cashReceivedUsd, setCashReceivedUsd,
    mixedPayments, updateMixedEntry, addMixedEntry, removeMixedEntry,
    isCredit, setIsCredit, creditClientId, setCreditClientId,
    creditClientName, setCreditClientName, creditClientDebt, setCreditClientDebt,
    creditDays, setCreditDays,
    addToCart, updateQuantity, removeFromCart, clearCart, toggleWholesale,
    isGranMayorMode, toggleGranMayor,
  };
}
