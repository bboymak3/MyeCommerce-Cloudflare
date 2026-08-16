"use client";

import { printTicket as _printTicket } from "@/lib/ticket-printer";
import type { TicketSettings } from "@/lib/ticket-printer";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/app-store";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────
import type { PosTabProps, Product } from "./pos/types";
import { USD_METHODS, REF_REQUIRED_METHODS } from "./pos/types";

// ─── Hooks ───────────────────────────────────────────────────────
import { useCart } from "./pos/hooks/use-cart";
import { useClients } from "./pos/hooks/use-clients";
import { useScanner } from "./pos/hooks/use-scanner";
import { useKeyboardShortcuts } from "./pos/hooks/use-keyboard-shortcuts";
import { useBarcodeWedge } from "./pos/hooks/use-barcode-wedge";
import { usePosCalculations } from "./pos/hooks/use-pos-calculations";

// ─── Sub-components ─────────────────────────────────────────────
import { CartPanel } from "./pos/cart/cart-panel";
import { ProductPanel } from "./pos/products/product-panel";
import { ShortcutsBar } from "./pos/shortcuts-bar";
import { ScannerDialog } from "./pos/dialogs/scanner-dialog";
import { ClientSelectDialog } from "./pos/dialogs/client-select-dialog";
import { ClientCreateDialog } from "./pos/dialogs/client-create-dialog";
import { ReceiptDialog } from "./pos/dialogs/receipt-dialog";
import { CreditConfirmDialog } from "./pos/dialogs/credit-confirm-dialog";
import { StockWarningDialog } from "./pos/dialogs/stock-warning-dialog";
import { QrAccessDialog } from "./pos/dialogs/qr-access-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function PosTab(props: PosTabProps) {
  const {
    products, bcvRate, euroUsdtRate, taxRate, storeName, storeAddress, storeRif, storePhone = "",
    currency, allowZeroStock = false, enableDiscount = false, maxDiscountPct = 20,
    canSaleNotes = false, canFrequentCustomers = false,
    sellerName: propSellerName = "", sellerRole: propSellerRole = "",
    ticketFontSize = 8, ticketFontFamily = "monospace",
    ticketHeaderMsg = "", ticketFooterMsg = "Gracias por su compra!",
    ticketShowPhone = true, ticketShowSeller = true, ticketShowExchange = true,
    ticketShowSlogan = false, ticketShowCashReceived = true, ticketShowLogo = true,
    ticketBold = true, ticketPaperWidth = "58mm",
    ticketMarginLeft = 0, ticketMarginRight = 0,
    ticketUseAgent = true, ticketAgentUrl = "http://localhost:9100",
    ticketCurrencyMode = "dual", storeLogo = "", businessType = "general",
    taxMode = "included", onSaleComplete, onHoldSale,
    initialCart, initialClient, initialNotes, initialDiscount, initialPaymentMethod,
  } = props;

  // ─── Custom hooks ─────────────────────────────────────────────
  const cartHook = useCart({ products, allowZeroStock, maxDiscountPct, bcvRate, euroUsdtRate });
  const clientHook = useClients();

  const {
    addToCart, updateQuantity, removeFromCart, clearCart, toggleWholesale,
    isGranMayorMode, toggleGranMayor,
    cart, subtotal, discount, setDiscount, notes, setNotes,
    paymentMethod, setPaymentMethod, referenceNumber, setReferenceNumber,
    cashReceived, setCashReceived, cashReceivedUsd, setCashReceivedUsd,
    mixedPayments, updateMixedEntry, addMixedEntry, removeMixedEntry,
    isCredit, setIsCredit, creditClientId, setCreditClientId,
    creditClientName, setCreditClientName, creditClientDebt, setCreditClientDebt,
    creditDays, setCreditDays,
  } = cartHook;

  const {
    clients, selectedClient,
    showClientDialog, setShowClientDialog,
    showNewClientDialog, setShowNewClientDialog,
    clientSearch, setClientSearch, clientResults,
    newClientForm, setNewClientForm,
    searchClients, selectFinalClient, selectNoClient, selectClient, createQuickClient,
  } = clientHook;

  // ─── Scanner hook ─────────────────────────────────────────────
  const scanner = useScanner({
    products,
    onProductFound: addToCart,
    onCodeDetected: (code) => { /* search state managed by parent if needed */ },
  });

  // ─── USB/Bluetooth barcode wedge scanner ──────────────────
  // (moved after anyDialogOpen declaration - see below)

  // ─── Local POS state ─────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [sellerName, setSellerName] = useState(propSellerName);
  const [sellerRole] = useState(propSellerRole);
  const [showReceipt, setShowReceipt] = useState<any>(null);
  const [showStockWarning, setShowStockWarning] = useState<any>(null);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [localUrl, setLocalUrl] = useState("");
  const [secureUrl, setSecureUrl] = useState("");

  // Refs
  const isSubmittingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const cashUsdInputRef = useRef<HTMLInputElement>(null);
  const skipDebtConfirmRef = useRef(false);

  // Sync cart count to global store
  const setCartItemCount = useAppStore((s) => s.setCartItemCount);
  useEffect(() => { setCartItemCount(cart.length); }, [cart.length, setCartItemCount]);

  // Auto-fill seller name
  useEffect(() => { if (propSellerName && !sellerName) setSellerName(propSellerName); }, [propSellerName]);

  // Auto-focus search on mount
  useEffect(() => { searchInputRef.current?.focus(); }, []);

  // Fetch local IP for QR
  useEffect(() => {
    authFetch("/api/local-ip", {}).then((r) => r.json()).then((d) => { setLocalUrl(d.url || ""); setSecureUrl(d.secureUrl || ""); }).catch(() => { setLocalUrl(""); setSecureUrl(""); });
  }, []);

  // Auto-focus cash input only on explicit payment method change (NOT on cart change)
  const prevPaymentMethodRef = useRef(paymentMethod);
  useEffect(() => {
    if (paymentMethod === "efectivo" && !isCredit && cart.length > 0 && prevPaymentMethodRef.current !== paymentMethod) {
      setTimeout(() => cashInputRef.current?.focus(), 100);
    } else if (paymentMethod === "efectivo-usd" && !isCredit && cart.length > 0 && prevPaymentMethodRef.current !== paymentMethod) {
      setTimeout(() => cashUsdInputRef.current?.focus(), 100);
    }
    prevPaymentMethodRef.current = paymentMethod;
  }, [paymentMethod, isCredit, cart.length]);

  // Load initial cart from held sale / quote
  useEffect(() => {
    if (initialCart && initialCart.length > 0) {
      cartHook.setCart(initialCart);
      if (initialClient) {
        clientHook.setSelectedClient(initialClient);
        setCreditClientId(initialClient.id);
        setCreditClientName(initialClient.fullName);
      }
      if (initialNotes) setNotes(initialNotes);
      if (initialDiscount) setDiscount(initialDiscount);
      if (initialPaymentMethod) setPaymentMethod(initialPaymentMethod);
      toast.success("Carrito cargado desde factura en espera / presupuesto");
    }
  }, [initialCart]);

  // ─── Calculations ────────────────────────────────────────────
  const { taxAmount, effectiveDiscount, total, totalBs } = usePosCalculations({
    cart, taxRate, taxMode, discount, bcvRate, maxDiscountPct, subtotal,
  });

  const isUsdMethod = USD_METHODS.includes(paymentMethod as any);
  const vuelto = !isCredit && paymentMethod === "efectivo" ? parseFloat(cashReceived || "0") - totalBs : 0;
  const vueltoUsd = !isCredit && paymentMethod === "efectivo-usd" ? parseFloat(cashReceivedUsd || "0") - total : 0;
  const showRefField = REF_REQUIRED_METHODS.includes(paymentMethod as any);

  // Mixed payment totals
  const mixedTotalBs = useMemo(() => mixedPayments.reduce((s, e) => s + e.amountBs, 0), [mixedPayments]);
  const mixedRemaining = useMemo(() => Math.max(0, totalBs - mixedTotalBs), [totalBs, mixedTotalBs]);
  const mixedRemainingUsd = useMemo(() => (bcvRate > 0 ? mixedRemaining / bcvRate : 0), [bcvRate, mixedRemaining]);
  const isMixedValid = useMemo(() => Math.abs(mixedTotalBs - totalBs) < 0.01, [mixedTotalBs, totalBs]);

  // ─── Keyboard shortcuts ───────────────────────────────────────
  const anyDialogOpen = showClientDialog || showNewClientDialog || showCreditConfirm
    || showStockWarning || showQrModal || showClearCartConfirm || scanner.showScanner || !!showReceipt;

  // ─── USB/Bluetooth barcode wedge scanner ──────────────────
  useBarcodeWedge({
    products,
    onProductScanned: addToCart,
    anyDialogOpen,
  });

  useKeyboardShortcuts({
    cartLength: cart.length,
    isCredit,
    anyDialogOpen,
    onF2: () => searchInputRef.current?.focus(),
    onF4: () => setIsCredit((p) => !p),
    onF5: () => setPaymentMethod("efectivo-usd"),
    onF6: () => setPaymentMethod("efectivo"),
    onF7: () => setPaymentMethod("pago-movil"),
    onF8: () => completeSale(),
    onF9: () => holdCurrentSale(),
    onEsc: () => { if (cart.length > 0) setShowClearCartConfirm(true); },
  });

  // ─── Credit client change handler ─────────────────────────────
  const handleCreditClientChange = useCallback((id: string) => {
    setCreditClientId(id);
    const sel = clients.find((c) => c.id === id);
    if (sel) {
      setCreditClientName(sel.fullName);
      setCreditClientDebt(sel.creditBalance || 0);
    }
  }, [clients, setCreditClientId, setCreditClientName, setCreditClientDebt]);

  // ─── Hold sale ────────────────────────────────────────────────
  const holdCurrentSale = useCallback(async () => {
    if (cart.length === 0) { toast.error("El carrito esta vacio"); return; }
    const heldData = {
      items: cart.map((item) => ({
        productId: item.id, productName: item.name, quantity: item.quantity,
        unitPrice: item.price, total: item.total, taxType: item.taxType || "general",
      })),
      clientName: selectedClient ? selectedClient.fullName : "Cliente Final",
      clientId: selectedClient?.id || null,
      subtotal, taxAmount: 0, discount: effectiveDiscount,
      total, totalBs: total * bcvRate, exchangeRate: bcvRate,
      paymentMethod, notes, sellerName, sellerRole: propSellerRole || "",
    };
    try {
      if (onHoldSale) await onHoldSale(heldData);
      clearCart();
      toast.success("Factura puesta en espera");
    } catch (e: any) { toast.error(e.message || "Error al poner en espera"); }
  }, [cart, selectedClient, subtotal, effectiveDiscount, total, bcvRate, paymentMethod, notes, sellerName, propSellerRole, onHoldSale, clearCart]);

  // ─── Complete sale ────────────────────────────────────────────
  const completeSale = useCallback(async () => {
    if (isSubmittingRef.current) return;
    if (cart.length === 0) { toast.error("El carrito esta vacio"); return; }
    if (total <= 0) { toast.error("El total debe ser mayor a cero"); return; }
    if (!bcvRate || bcvRate <= 0) { toast.error("La tasa de cambio no esta configurada. Vaya a Configuracion."); return; }
    if (effectiveDiscount > subtotal) { toast.error("Descuento mayor al subtotal"); return; }

    // Credit validations
    if (isCredit) {
      if (!creditClientId) { toast.error("Debe seleccionar un cliente para la venta a credito"); return; }
      const selClient = clients.find((c) => c.id === creditClientId);
      const clientLimit = selClient?.creditLimit ?? 0;
      const newTotal = (selClient?.creditBalance ?? 0) + total;
      if (clientLimit > 0 && newTotal > clientLimit) {
        toast.error(`Limite de credito excedido. Deuda: $${(selClient?.creditBalance || 0).toFixed(2)} + Venta: $${total.toFixed(2)} = $${newTotal.toFixed(2)} (Limite: $${clientLimit.toFixed(2)})`);
        return;
      }
      if (creditClientDebt > 0 && !skipDebtConfirmRef.current) {
        setShowCreditConfirm(true);
        return;
      }
      skipDebtConfirmRef.current = false;
    }

    // Cash validation Bs
    if (!isCredit && paymentMethod === "efectivo" && parseFloat(cashReceived || "0") < totalBs) {
      toast.error(`Efectivo insuficiente. Total: Bs ${totalBs.toFixed(2)}, Recibido: Bs ${parseFloat(cashReceived || "0").toFixed(2)}`);
      return;
    }
    // Cash validation USD
    if (!isCredit && paymentMethod === "efectivo-usd" && parseFloat(cashReceivedUsd || "0") < total) {
      toast.error(`Efectivo insuficiente. Total: $${total.toFixed(2)}, Recibido: $${parseFloat(cashReceivedUsd || "0").toFixed(2)}`);
      return;
    }
    // Reference validation
    if (!isCredit && showRefField && paymentMethod !== "mixto" && !referenceNumber.trim()) {
      toast.error("Debe ingresar el numero de referencia de la transaccion");
      return;
    }
    // Mixed validation
    if (!isCredit && paymentMethod === "mixto") {
      const filled = mixedPayments.filter((e) => e.amountBs > 0);
      if (filled.length < 2) { toast.error("En pago mixto debe usar al menos 2 metodos de pago"); return; }
      if (!isMixedValid) { toast.error(`El desglose no coincide con el total. Faltan Bs ${mixedRemaining.toFixed(2)}`); return; }
      const needsRef = filled.filter((e) => ["transferencia", "pago-movil", "zelle", "usdt"].includes(e.method) && !e.reference.trim());
      if (needsRef.length > 0) { toast.error("Los metodos Transferencia, Pago Movil, Zelle y USDT requieren referencia"); return; }
    }
    // Weight validation
    const sinPeso = cart.filter((i) => i.vendePorPeso && (!i.pesoIngresado || i.quantity <= 0));
    if (sinPeso.length > 0) { toast.error(`Ingrese el peso para: ${sinPeso.map((i) => i.name).join(", ")}`); return; }
    // Stock validation
    if (!allowZeroStock) {
      const insufficient = cart.filter((i) => { const p = products.find((pp) => pp.id === i.id); return p && i.quantity > p.stock; });
      if (insufficient.length > 0) { toast.error(`Stock insuficiente: ${insufficient.map((i) => i.name).join(", ")}`); return; }
    }

    // Build mixed JSON
    let mixedJson = "";
    if (paymentMethod === "mixto") {
      mixedJson = JSON.stringify(mixedPayments.filter((e) => e.amountBs > 0).map((e) => ({
        method: e.method, amountBs: e.amountBs, amountUsd: e.amountUsd, reference: e.reference,
      }))).replace(/'/g, "''");
    }
    const saleRef = paymentMethod === "mixto" ? "" : referenceNumber.trim();

    try {
      isSubmittingRef.current = true;
      const res = await authFetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal, taxAmount, discount: effectiveDiscount, total, totalBs,
          exchangeRate: bcvRate, paymentMethod, referenceNumber: saleRef, mixedPaymentJson: mixedJson,
          sellerName, sellerRole, notes,
          isCredit,
          creditPaid: isCredit ? 0 : undefined,
          creditDays: isCredit ? creditDays : undefined,
          clientId: isCredit && creditClientId ? creditClientId : selectedClient?.id || null,
          clientDocType: isCredit ? (clients.find((c) => c.id === creditClientId)?.docType || "") : selectedClient?.docType || "",
          clientDocNumber: isCredit ? (clients.find((c) => c.id === creditClientId)?.docNumber || "") : selectedClient?.docNumber || "",
          clientName: isCredit ? creditClientName : selectedClient?.fullName || "",
          clientAddress: isCredit ? (clients.find((c) => c.id === creditClientId)?.address || "") : selectedClient?.address || "",
          customerName: isCredit ? creditClientName : selectedClient?.fullName || "",
          items: cart.map((item) => ({
            productId: item.id, productName: item.name,
            quantity: item.quantity, unitPrice: item.price, total: item.total,
            taxType: item.taxType || "general",
          })),
        }),
      });
      const sale = await res.json();
      if (!res.ok) {
        if (sale.code === "INSUFFICIENT_STOCK") { setShowStockWarning(sale); return; }
        throw new Error(sale.error);
      }
      setShowReceipt({
        ...sale, paymentMethod, notes, client: selectedClient, referenceNumber: saleRef, mixedPaymentJson: mixedJson,
        cashReceived: paymentMethod === "efectivo" ? parseFloat(cashReceived || "0") : paymentMethod === "efectivo-usd" ? parseFloat(cashReceivedUsd || "0") : 0,
        vuelto: paymentMethod === "efectivo" ? vuelto : paymentMethod === "efectivo-usd" ? vueltoUsd : 0,
      });
      if (isCredit) {
        toast.success(`Venta a credito registrada a ${creditClientName} — $${total.toFixed(2)}`);
      } else {
        toast.success("Venta registrada exitosamente");
      }
      clearCart();
      if (onSaleComplete) onSaleComplete();
    } catch (error: any) { toast.error(error.message || "Error al registrar venta"); }
    finally { isSubmittingRef.current = false; }
  }, [
    cart, total, bcvRate, effectiveDiscount, subtotal, isCredit, creditClientId, clients,
    creditClientDebt, paymentMethod, cashReceived, cashReceivedUsd, showRefField,
    referenceNumber, mixedPayments, isMixedValid, mixedRemaining, allowZeroStock, products,
    taxAmount, sellerName, sellerRole, notes, selectedClient, creditClientName, creditDays,
    bcvRate, totalBs, vuelto, vueltoUsd, clearCart, onSaleComplete,
  ]);

  // ─── Print ticket ────────────────────────────────────────────
  const printTicket = useCallback(async (receipt: any) => {
    const ticketSettings: TicketSettings = {
      storeName, storeRif, storeAddress, storePhone,
      ticketFontSize, ticketFontFamily, ticketBold,
      ticketShowPhone, ticketShowSeller, ticketShowExchange, ticketShowSlogan,
      ticketShowCashReceived, ticketShowLogo,
      ticketPaperWidth, ticketMarginLeft, ticketMarginRight,
      ticketHeaderMsg, ticketFooterMsg,
      ticketUseAgent: ticketUseAgent ?? true,
      ticketAgentUrl: ticketAgentUrl || "http://localhost:9100",
      ticketCurrencyMode: ticketCurrencyMode || "dual",
      storeLogo, businessType, taxMode, taxRate,
    };
    try {
      const ok = await _printTicket({ receipt, settings: ticketSettings, currency, defaultSellerName: sellerName });
      if (!ok) toast.error("No se pudo abrir ventana de impresion. Permita ventanas emergentes.");
    } catch (e: any) { toast.error("Impresion: " + (e.message || "desconocido"), { duration: 8000 }); }
  }, [storeName, storeRif, storeAddress, storePhone, ticketFontSize, ticketFontFamily, ticketBold,
    ticketShowPhone, ticketShowSeller, ticketShowExchange, ticketShowSlogan,
    ticketShowCashReceived, ticketShowLogo, ticketPaperWidth, ticketMarginLeft, ticketMarginRight, ticketHeaderMsg, ticketFooterMsg,
    ticketUseAgent, ticketAgentUrl, ticketCurrencyMode, storeLogo, businessType, taxMode, taxRate,
    currency, sellerName]);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full">
      {/* Cart (3/5) — on md+ (tablets landscape & desktop) side by side */}
      <CartPanel
        cart={cart} products={products} currency={currency} allowZeroStock={allowZeroStock}
        onClearCart={() => setShowClearCartConfirm(true)} onUpdateQty={updateQuantity} onRemove={removeFromCart}
        onToggleWholesale={toggleWholesale}
        isGranMayorMode={isGranMayorMode} onToggleGranMayor={toggleGranMayor}
        selectedClient={selectedClient} onOpenClientDialog={() => setShowClientDialog(true)}
        onOpenQrModal={() => setShowQrModal(true)}
        paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
        referenceNumber={referenceNumber} setReferenceNumber={setReferenceNumber}
        cashReceived={cashReceived} setCashReceived={setCashReceived}
        cashReceivedUsd={cashReceivedUsd} setCashReceivedUsd={setCashReceivedUsd}
        isCredit={isCredit} setIsCredit={setIsCredit}
        creditClientId={creditClientId} setCreditClientId={handleCreditClientChange}
        creditClientName={creditClientName} creditClientDebt={creditClientDebt}
        creditDays={creditDays} setCreditDays={setCreditDays} clients={clients}
        mixedPayments={mixedPayments} updateMixedEntry={updateMixedEntry}
        addMixedEntry={addMixedEntry} removeMixedEntry={removeMixedEntry}
        isMixedValid={isMixedValid} mixedTotalBs={mixedTotalBs}
        mixedRemaining={mixedRemaining} mixedRemainingUsd={mixedRemainingUsd}
        enableDiscount={enableDiscount} discount={discount || ""} setDiscount={setDiscount}
        maxDiscountPct={maxDiscountPct} subtotal={subtotal}
        canSaleNotes={canSaleNotes} notes={notes} setNotes={setNotes}
        bcvRate={bcvRate} total={total} totalBs={totalBs}
        taxAmount={taxAmount} taxRate={taxRate} taxMode={taxMode}
        effectiveDiscount={effectiveDiscount} isUsdMethod={isUsdMethod}
        vuelto={vuelto} vueltoUsd={vueltoUsd}
        cashInputRef={cashInputRef} cashUsdInputRef={cashUsdInputRef}
        onCompleteSale={completeSale}
        onSearchFocus={() => searchInputRef.current?.focus()}
        onToggleCredit={() => setIsCredit((p: boolean) => !p)}
        onSetCashUsd={() => setPaymentMethod("efectivo-usd")}
        onSetCashBs={() => setPaymentMethod("efectivo")}
        onSetPagoMovil={() => setPaymentMethod("pago-movil")}
        onCharge={() => completeSale()}
        onHoldSale={() => holdCurrentSale()}
      />

      {/* Products (2/5) */}
      <ProductPanel
        products={products} currency={currency} bcvRate={bcvRate} allowZeroStock={allowZeroStock}
        search={search} setSearch={setSearch}
        selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
        selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand}
        onAddToCart={addToCart}
        onOpenQrModal={() => setShowQrModal(true)}
        onStartScanner={() => scanner.startScanner("product")}
        searchInputRef={searchInputRef}
      />

      {/* ─── All Dialogs ──────────────────────────────────────── */}
      <ScannerDialog
        open={scanner.showScanner}
        loading={scanner.scannerLoading}
        error={scanner.scannerError}
        scannerDivId={scanner.scannerDivRef.current}
        search={search}
        onSearchChange={setSearch}
        onClose={scanner.stopScanner}
        onRetry={() => scanner.startScanner(scanner.scannerMode)}
      />

      <ClientSelectDialog
        open={showClientDialog}
        onOpenChange={setShowClientDialog}
        clientSearch={clientSearch}
        onClientSearchChange={(v) => { setClientSearch(v); searchClients(v); }}
        clientResults={clientResults}
        onSelectClient={selectClient}
        onSelectFinalClient={selectFinalClient}
        onSelectNoClient={selectNoClient}
        onOpenNewClient={() => { setShowClientDialog(false); setShowNewClientDialog(true); }}
      />

      <ClientCreateDialog
        open={showNewClientDialog}
        onOpenChange={setShowNewClientDialog}
        form={newClientForm}
        onFormChange={setNewClientForm}
        onSubmit={createQuickClient}
      />

      <ReceiptDialog
        receipt={showReceipt}
        storeName={storeName} storeRif={storeRif} storeAddress={storeAddress} bcvRate={bcvRate}
        onPrint={printTicket}
        onClose={() => setShowReceipt(null)}
      />

      <CreditConfirmDialog
        open={showCreditConfirm}
        clientName={creditClientName}
        clientDebt={creditClientDebt}
        total={total} totalBs={totalBs}
        onCancel={() => { setShowCreditConfirm(false); skipDebtConfirmRef.current = false; }}
        onConfirm={() => { setShowCreditConfirm(false); skipDebtConfirmRef.current = true; completeSale(); }}
      />

      <StockWarningDialog
        data={showStockWarning}
        onClose={() => setShowStockWarning(null)}
      />

      <QrAccessDialog
        open={showQrModal}
        onOpenChange={setShowQrModal}
        localUrl={localUrl}
        secureUrl={secureUrl}
      />

      {/* Confirmacion al vaciar carrito */}
      <Dialog open={showClearCartConfirm} onOpenChange={setShowClearCartConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-orange-600">⚠️ Carrito con articulos</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Hay <span className="font-bold text-foreground">{cart.length}</span> articulo(s) en el carrito por un total de <span className="font-bold text-foreground">${total.toFixed(2)}</span> / <span className="font-bold text-foreground">Bs {totalBs.toFixed(2)}</span>
            </p>
            <p className="text-sm text-center font-medium">¿Desea vaciar el carrito o cancelar?</p>
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={() => { clearCart(); setShowClearCartConfirm(false); toast.success("Carrito vaciado"); }}>
                Vaciar Carrito
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowClearCartConfirm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
