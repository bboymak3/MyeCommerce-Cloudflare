"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Product } from "../types";

interface UseBarcodeWedgeOptions {
  products: Product[];
  onProductScanned: (product: Product) => void;
  enabled?: boolean;
  anyDialogOpen?: boolean;
}

export function useBarcodeWedge({ products, onProductScanned, enabled = true, anyDialogOpen = false }: UseBarcodeWedgeOptions) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleScan = useCallback((code: string) => {
    const cleanCode = code.trim();
    if (cleanCode.length < 3) return; // Too short to be a barcode

    // Search by barcode (primary and secondary)
    const found = products.find(
      (p) => p.barcode === cleanCode || p.secondaryBarcode === cleanCode
    );

    if (found) {
      onProductScanned(found);
    }
  }, [products, onProductScanned]);

  useEffect(() => {
    if (!enabled || anyDialogOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is on an input, textarea, or select (unless it's the search)
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isSearchInput = target.id === "pos-search" || target.closest('[data-pos-search]');

      if (!isSearchInput && (tagName === "input" || tagName === "textarea" || tagName === "select")) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      // Reset buffer if too much time passed (> 100ms = normal typing, not scanner)
      if (timeDiff > 100) {
        bufferRef.current = "";
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

        if (bufferRef.current.length >= 3) {
          handleScan(bufferRef.current);
        }
        bufferRef.current = "";
        lastKeyTimeRef.current = 0;
      } else if (e.key.length === 1) {
        // Regular character
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;

        // Clear buffer after 500ms timeout if no Enter follows
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, 500);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, anyDialogOpen, handleScan]);
}
