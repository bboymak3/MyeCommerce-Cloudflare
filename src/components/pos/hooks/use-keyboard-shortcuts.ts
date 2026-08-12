"use client";

import { useEffect } from "react";

interface ShortcutConfig {
  cartLength: number;
  isCredit: boolean;
  anyDialogOpen: boolean;
  onF2: () => void;   // focus search
  onF4: () => void;   // toggle credit
  onF5: () => void;   // efectivo-usd
  onF6: () => void;   // efectivo Bs
  onF7: () => void;   // pago-movil
  onF8: () => void;   // cobrar
  onF9: () => void;   // poner en espera
  onEsc: () => void;  // vaciar carrito
}

export function useKeyboardShortcuts(cfg: ShortcutConfig) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cfg.anyDialogOpen) return;
      if (e.key === "F2") { e.preventDefault(); cfg.onF2(); }
      if (e.key === "F4") { e.preventDefault(); cfg.onF4(); }
      if (e.key === "F5") { e.preventDefault(); cfg.onF5(); }
      if (e.key === "F6") { e.preventDefault(); cfg.onF6(); }
      if (e.key === "F7") { e.preventDefault(); cfg.onF7(); }
      if (e.key === "F8" && cfg.cartLength > 0) { e.preventDefault(); cfg.onF8(); }
      if (e.key === "F9" && cfg.cartLength > 0) { e.preventDefault(); cfg.onF9(); }
      if (e.key === "Escape" && cfg.cartLength > 0) { e.preventDefault(); cfg.onEsc(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cfg.cartLength, cfg.isCredit, cfg.anyDialogOpen,
    cfg.onF2, cfg.onF4, cfg.onF5, cfg.onF6, cfg.onF7, cfg.onF8, cfg.onF9, cfg.onEsc,
  ]);
}
