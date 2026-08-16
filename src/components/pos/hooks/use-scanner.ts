"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import type { Product } from "../types";

interface UseScannerOptions {
  products: Product[];
  onProductFound: (product: Product) => void;
  onCodeDetected: (code: string) => void;
}

export function useScanner({ products, onProductFound, onCodeDetected }: UseScannerOptions) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState<"product" | "client">("product");
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<any>(null);
  const scannerDivRef = useRef<string>("pos-scanner-" + Date.now());

  const handleScannedCode = useCallback(
    (code: string) => {
      if (scannerMode === "product") {
        const found = products.find((p) => p.barcode === code || p.secondaryBarcode === code);
        if (found) {
          onProductFound(found);
          toast.success(`Producto: ${found.name}`);
        } else {
          toast.info(`Codigo escaneado: ${code} - No se encontro producto`);
        }
      }
      onCodeDetected(code);
    },
    [scannerMode, products, onProductFound, onCodeDetected],
  );

  // stopScanner debe declararse ANTES de startScanner para evitar
  // "Cannot access before initialization"
  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === 2) await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (e) { console.error("Error stopping scanner:", e); }
    setShowScanner(false);
    setScannerError("");
  }, []);

  const startScanner = useCallback(
    async (mode: "product" | "client") => {
      setScannerMode(mode);
      setShowScanner(true);
      setScannerLoading(true);
      setScannerError("");

      // Esperar a que el Dialog renderice el div del scanner
      await new Promise(r => setTimeout(r, 400));

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scannerId = scannerDivRef.current;
        // Verificar que el div existe
        const divEl = document.getElementById(scannerId);
        if (!divEl) throw new Error("No se encontro el elemento del escaner. Reintente.");

        const html5QrCode = new Html5Qrcode(scannerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText: string) => {
            stopScanner();
            handleScannedCode(decodedText);
          },
          () => { /* scanning frame */ },
        );
        setScannerLoading(false);
      } catch (err: any) {
        setScannerLoading(false);
        const msg = (err?.message || err?.toString() || "").toLowerCase();
        let errorMsg = "";
        if (msg.includes("permission") || msg.includes("notallowederror")) {
          errorMsg = "Permiso de camara denegado. Active la camara en el navegador (icono de candado) y recargue la pagina.";
        } else if (msg.includes("notfound") || msg.includes("notfounderror")) {
          errorMsg = "No se encontro ninguna camara. Verifique que este conectada.";
        } else if (msg.includes("notreadable") || msg.includes("aborterror")) {
          errorMsg = "La camara esta siendo usada por otra aplicacion.";
        } else if (msg.includes("notsecure") || msg.includes("secure context")) {
          const host = typeof window !== "undefined" ? window.location.hostname : "";
          const port = typeof window !== "undefined" ? window.location.port : "";
          if (host === "localhost" || host === "127.0.0.1") {
            errorMsg = "Permiso de camara denegado en localhost. Verifique que el navegador tenga permiso para acceder a la camara.";
          } else if (port === "3000") {
            errorMsg = "La camara requiere HTTPS. Desde el telefono use https://" + host + ":8443 (no http://" + host + ":3000)";
          } else {
            errorMsg = "La camara requiere HTTPS. Use https://" + host + (port ? ":" + port : "") + " en vez de HTTP.";
          }
        } else {
          errorMsg = `Error al iniciar el escaner: ${err?.message || "Error desconocido"}.`;
        }
        setScannerError(errorMsg);
        console.error("Scanner error:", err);
      }
    },
    [handleScannedCode, stopScanner],
  );

  return {
    showScanner, scannerMode, scannerLoading, scannerError,
    scannerDivRef, startScanner, stopScanner,
  };
}
