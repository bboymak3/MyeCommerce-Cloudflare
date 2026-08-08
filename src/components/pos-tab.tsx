"use client";

import { printTicket as _printTicket } from "@/lib/ticket-printer";
import type { TicketSettings } from "@/lib/ticket-printer";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface Product {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  cost: number;
  stock: number;
  minStock: number;
  barcode: string;
  icon: string;
  noStock: boolean;
  vendePorPeso?: boolean;
  unidadPeso?: string;
  category?: { name: string } | null;
}

interface CartItem extends Product {
  quantity: number;
  total: number;
  isWholesale: boolean;
  pesoIngresado?: boolean;
}

interface ClientData {
  id: string;
  type: string;
  docType: string;
  docNumber: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  isFinalClient: boolean;
  creditBalance?: number;
  creditLimit?: number;
}

interface PosTabProps {
  products: Product[];
  bcvRate: number;
  taxRate: number;
  storeName: string;
  storeAddress: string;
  storeRif: string;
  storePhone: string;
  currency: string;
  allowZeroStock?: boolean;
  enableDiscount?: boolean;
  maxDiscountPct?: number;
  canSaleNotes?: boolean;
  canFrequentCustomers?: boolean;
  sellerName?: string;
  sellerRole?: string;
  ticketFontSize?: number;
  ticketFontFamily?: string;
  ticketHeaderMsg?: string;
  ticketFooterMsg?: string;
  ticketShowPhone?: boolean;
  ticketShowSeller?: boolean;
  ticketShowExchange?: boolean;
  ticketShowSlogan?: boolean;
  ticketBold?: boolean;
  ticketPaperWidth?: string;
  ticketMarginLeft?: number;
  ticketMarginRight?: number;
  ticketUseAgent?: boolean;
  ticketAgentUrl?: string;
  ticketCurrencyMode?: string;
  onSaleComplete?: () => void;
}

export default function PosTab({
  products, bcvRate, taxRate, storeName, storeAddress, storeRif, storePhone = "", currency,
  allowZeroStock = false, enableDiscount = false, maxDiscountPct = 20,
  canSaleNotes = false, canFrequentCustomers = false, sellerName: propSellerName = "", sellerRole: propSellerRole = "",
  ticketFontSize = 8, ticketFontFamily = "monospace",
  ticketHeaderMsg = "", ticketFooterMsg = "Gracias por su compra!",
  ticketShowPhone = true, ticketShowSeller = true, ticketShowExchange = true, ticketShowSlogan = false,
  ticketBold = true, ticketPaperWidth = "58mm",
  ticketMarginLeft = 0, ticketMarginRight = 0,
  ticketUseAgent = true, ticketAgentUrl = "http://localhost:9100",
  ticketCurrencyMode = "dual",
  onSaleComplete,
}: PosTabProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [sellerName, setSellerName] = useState(propSellerName);
  const [sellerRole] = useState(propSellerRole);

  // Auto-fill seller name when prop changes
  useEffect(() => {
    if (propSellerName && !sellerName) setSellerName(propSellerName);
  }, [propSellerName]);
  const [showReceipt, setShowReceipt] = useState<any>(null);
  const [showStockWarning, setShowStockWarning] = useState<any>(null);

  // Payment reference
  const [referenceNumber, setReferenceNumber] = useState("");

  // Mixed payment state
  interface MixedEntry {
    method: string;
    amountBs: number;
    amountUsd: number;
    reference: string;
  }
  const [mixedPayments, setMixedPayments] = useState<MixedEntry[]>([
    { method: "efectivo", amountBs: 0, amountUsd: 0, reference: "" },
    { method: "pago-movil", amountBs: 0, amountUsd: 0, reference: "" },
  ]);

  // Client state
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientData[]>([]);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    type: "natural", docType: "V", docNumber: "", firstName: "", lastName: "",
    businessName: "", phone: "", email: "", address: "",
  });

  // Credit state
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isCredit, setIsCredit] = useState(false);
  const [creditClientId, setCreditClientId] = useState("");
  const [creditClientName, setCreditClientName] = useState("");
  const [creditClientDebt, setCreditClientDebt] = useState(0);
  const [creditDays, setCreditDays] = useState(30);

  // Vuelto (change) state
  const [cashReceived, setCashReceived] = useState("");
  const [cashReceivedUsd, setCashReceivedUsd] = useState("");

  // Guard against double-submit — useRef es sincrono, useState NO lo es
  const isSubmittingRef = useRef(false);

  // Search auto-focus ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cash received auto-focus ref
  const cashInputRef = useRef<HTMLInputElement>(null);
  const cashUsdInputRef = useRef<HTMLInputElement>(null);

  // Confirm dialog for credit sale with existing debt
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const skipDebtConfirmRef = useRef(false);

  // Auto-focus search on mount
  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  // Scanner state (declared BEFORE keyboard shortcuts useEffect to avoid TDZ error)
  const [showScanner, setShowScanner] = useState(false);

  // QR Mobile Access state
  const [showQrModal, setShowQrModal] = useState(false);
  const [localUrl, setLocalUrl] = useState('');

  // Fetch local IP for QR mobile access
  useEffect(() => {
    fetch('/api/local-ip')
      .then(r => r.json())
      .then(data => setLocalUrl(data.url || ''))
      .catch(() => setLocalUrl(''));
  }, []);

  // Auto-focus cash input when switching to efectivo
  useEffect(() => {
    if (paymentMethod === 'efectivo' && !isCredit && cart.length > 0) {
      setTimeout(() => cashInputRef.current?.focus(), 100);
    } else if (paymentMethod === 'efectivo-usd' && !isCredit && cart.length > 0) {
      setTimeout(() => cashUsdInputRef.current?.focus(), 100);
    }
  }, [paymentMethod, isCredit, cart.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block all shortcuts when any dialog is open
      const anyDialogOpen = showClientDialog || showNewClientDialog || showCreditConfirm
        || showStockWarning || showQrModal || showScanner || !!showReceipt;
      if (anyDialogOpen) return;

      if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'F4') { e.preventDefault(); setIsCredit(prev => !prev); }
      if (e.key === 'F5') { e.preventDefault(); setPaymentMethod('efectivo-usd'); }
      if (e.key === 'F6') { e.preventDefault(); setPaymentMethod('efectivo'); }
      if (e.key === 'F7') { e.preventDefault(); setPaymentMethod('pago-movil'); }
      if (e.key === 'F8' && cart.length > 0) { e.preventDefault(); completeSale(); }
      if (e.key === 'Escape' && cart.length > 0) { e.preventDefault(); clearCart(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, showReceipt, showScanner, showClientDialog, showNewClientDialog, showCreditConfirm, showStockWarning, showQrModal]);
  const [scannerMode, setScannerMode] = useState<"product" | "client">("product");
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<any>(null);
  const scannerDivRef = useRef<string>("pos-scanner-" + Date.now());

  const categories = [...new Map(
        products.filter(p => p.category)
          .map(p => [p.category!.name, { name: p.category!.name, icon: (p.category as any)?.icon || '', color: (p.category as any)?.color || '' }])
      ).values()];

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchCategory = !selectedCategory || p.category?.name === selectedCategory;
    const matchStock = allowZeroStock || p.noStock || p.stock > 0;
    return matchSearch && matchCategory && matchStock;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const discountPct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
  const effectiveDiscount = discountPct > maxDiscountPct ? (subtotal * maxDiscountPct) / 100 : discount;
  const total = subtotal + taxAmount - effectiveDiscount;
  const totalBs = total * bcvRate;

  // USD payment methods (electronic dollars: zelle, usdt)
  const isUsdMethod = ['zelle', 'usdt', 'efectivo-usd'].includes(paymentMethod);
  const isEfectivoUsd = paymentMethod === 'efectivo-usd';
  const vuelto = !isCredit && paymentMethod === 'efectivo' ? parseFloat(cashReceived || '0') - totalBs : 0;
  const vueltoUsd = !isCredit && isEfectivoUsd ? parseFloat(cashReceivedUsd || '0') - total : 0;

  // Mixed payment calculations
  const mixedTotalBs = mixedPayments.reduce((s, e) => s + e.amountBs, 0);
  const mixedRemaining = Math.max(0, totalBs - mixedTotalBs);
  const mixedRemainingUsd = bcvRate > 0 ? mixedRemaining / bcvRate : 0;
  const isMixedValid = Math.abs(mixedTotalBs - totalBs) < 0.01;
  const showRefField = ["transferencia", "pago-movil", "zelle", "usdt", "mixto"].includes(paymentMethod);

  // Cargar cliente final al inicio y lista de clientes para credito
  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then((data) => {
      setClients(data);
      const finalClient = data.find((c: ClientData) => c.isFinalClient);
      if (finalClient) setSelectedClient(finalClient);
    }).catch(() => {});
  }, []);

  // Buscar clientes
  const searchClients = useCallback(async (term: string) => {
    if (term.length < 1) { setClientResults([]); return; }
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(term)}`);
      const data = await res.json();
      setClientResults(data.slice(0, 8));
    } catch { setClientResults([]); }
  }, []);

  // Seleccionar cliente final
  const selectFinalClient = async () => {
    try {
      const res = await fetch("/api/clients?search=CLIENTE+FINAL");
      const data = await res.json();
      const fc = data.find((c: ClientData) => c.isFinalClient);
      if (fc) {
        setSelectedClient(fc);
        setShowClientDialog(false);
        toast.success("Cliente Final seleccionado");
      }
    } catch {}
  };

  // Facturar sin cliente
  const selectNoClient = () => {
    setSelectedClient(null);
    setShowClientDialog(false);
  };

  const selectClient = (client: ClientData) => {
    setSelectedClient(client);
    setShowClientDialog(false);
    setClientSearch("");
    setClientResults([]);
    toast.success(`Cliente: ${client.fullName}`);
  };

  // Crear cliente rapido desde POS
  const createQuickClient = async () => {
    const isJ = newClientForm.type === "juridico";
    const fullName = isJ ? newClientForm.businessName : `${newClientForm.firstName} ${newClientForm.lastName}`.trim();
    if (!fullName || !newClientForm.docNumber) { toast.error("Nombre y documento requeridos"); return; }
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newClientForm, fullName }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const client = await res.json();
      setSelectedClient(client);
      setShowNewClientDialog(false);
      setShowClientDialog(false);
      toast.success("Cliente creado y seleccionado");
    } catch (e: any) { toast.error(e.message); }
  };

  // ===== SCANNER QR / BARCODE =====
  const startScanner = async (mode: "product" | "client") => {
    setScannerMode(mode);
    setShowScanner(true);
    setScannerLoading(true);
    setScannerError("");

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode");

      const scannerId = scannerDivRef.current;
      const html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
        },
        (decodedText: string) => {
          // Code detected successfully
          stopScanner();
          handleScannedCode(decodedText);
        },
        () => {
          // Scanning frame - no code found, this is normal
        }
      );

      setScannerLoading(false);
    } catch (err: any) {
      setScannerLoading(false);
      let errorMsg = "";
      const errMsg = (err?.message || err?.toString() || "").toLowerCase();

      if (errMsg.includes("permission") || errMsg.includes("NotAllowedError")) {
        errorMsg = "Permiso de camara denegado. Permita el acceso a la camara en la configuracion del navegador (icono de candado/camara en la barra de direccion) y recargue la pagina.";
      } else if (errMsg.includes("notfound") || errMsg.includes("NotFoundError")) {
        errorMsg = "No se encontro ninguna camara en este dispositivo. Verifique que la camara este conectada y habilitada.";
      } else if (errMsg.includes("notreadable") || errMsg.includes("AbortError")) {
        errorMsg = "La camara esta siendo usada por otra aplicacion. Cierre otras aplicaciones que esten usando la camara e intente de nuevo.";
      } else if (errMsg.includes("notsecure") || errMsg.includes("secure context")) {
        errorMsg = "La camara requiere una conexion segura (HTTPS). Asegurese de acceder mediante https:// o localhost.";
      } else {
        errorMsg = `Error al iniciar el escaner: ${err?.message || "Error desconocido"}. Verifique que la camara este disponible y los permisos otorgados.`;
      }

      setScannerError(errorMsg);
      console.error("Scanner error:", err);
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (e) {
      console.error("Error stopping scanner:", e);
    }
    setShowScanner(false);
    setScannerError("");
  };

  const handleScannedCode = (code: string) => {
    if (scannerMode === "product") {
      setSearch(code);
      // Buscar el producto inmediatamente
      const found = products.find(p => p.barcode === code);
      if (found) {
        addToCart(found);
        toast.success(`Producto: ${found.name}`);
      } else {
        toast.info(`Codigo escaneado: ${code} - No se encontro producto`);
        setSearch("");
      }
    }
  };

  // ===== CART LOGIC =====
  const toggleWholesale = (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product || !product.wholesalePrice || product.wholesalePrice <= 0) {
      toast.error("Este producto no tiene precio mayorista configurado");
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const newIsWholesale = !item.isWholesale;
      const newPrice = newIsWholesale ? product.wholesalePrice : product.price;
      return { ...item, isWholesale: newIsWholesale, price: newPrice, total: item.quantity * newPrice };
    }));
  };

  const addToCart = (product: Product) => {
    // Alerta de stock bajo al agregar
    if (!product.noStock && product.stock > 0 && product.stock <= product.minStock) {
      toast.warning(`Stock bajo: ${product.name} (${product.stock} uds, min: ${product.minStock})`, {
        description: "Considerar reabastecer este producto",
        duration: 4000,
      });
    }

    // Productos por peso: agregan con cantidad 0 y esperan que se ingrese el peso
    if (product.vendePorPeso) {
      setCart((prev) => {
        const existing = prev.find((item) => item.id === product.id);
        if (existing) { toast.error("Producto ya esta en el carrito. Modifique el peso ahi."); return prev; }
        if (!allowZeroStock && !product.noStock && product.stock <= 0) { toast.error("Producto sin stock"); return prev; }
        return [...prev, { ...product, quantity: 0, total: 0, isWholesale: false, pesoIngresado: false }];
      });
      return;
    }
    // Productos normales: cantidad entera como antes
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        if (!allowZeroStock && !product.noStock && newQty > product.stock) {
          toast.error("Stock insuficiente"); return prev;
        }
        const price = existing.isWholesale ? (product.wholesalePrice || product.price) : product.price;
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: newQty, price, total: newQty * price } : item
        );
      }
      if (!allowZeroStock && !product.noStock && product.stock <= 0) { toast.error("Producto sin stock"); return prev; }
      return [...prev, { ...product, quantity: 1, total: product.price, isWholesale: false }];
    });
  };

  const updateQuantity = (id: string, qty: number) => {
    const item = cart.find(i => i.id === id);
    if (item?.vendePorPeso) {
      // Producto por peso: aceptar decimales, validar stock
      if (qty <= 0) { removeFromCart(id); return; }
      const product = products.find((p) => p.id === id);
      if (product && !allowZeroStock && !product.noStock && qty > product.stock) { toast.error("Stock insuficiente"); return; }
      setCart((prev) => prev.map((it) => (it.id === id ? { ...it, quantity: qty, total: parseFloat((qty * it.price).toFixed(2)), pesoIngresado: qty > 0 } : it)));
    } else {
      // Producto normal: minimo 1 unidad
      if (qty < 1) { removeFromCart(id); return; }
      const product = products.find((p) => p.id === id);
      if (product && !allowZeroStock && !product.noStock && qty > product.stock) { toast.error("Stock insuficiente"); return; }
      const price = item?.isWholesale ? (product?.wholesalePrice || product?.price || 0) : (product?.price || 0);
      setCart((prev) => prev.map((it) => (it.id === id ? { ...it, quantity: qty, price, total: qty * price } : it)));
    }
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((item) => item.id !== id));

  const clearCart = () => { setCart([]); setDiscount(0); setNotes(""); setReferenceNumber(""); setCashReceived(""); setCashReceivedUsd(""); setMixedPayments([{ method: "efectivo", amountBs: 0, amountUsd: 0, reference: "" }, { method: "pago-movil", amountBs: 0, amountUsd: 0, reference: "" }]); setPaymentMethod("efectivo"); setIsCredit(false); setCreditClientId(""); setCreditClientName(""); setCreditClientDebt(0); setCreditDays(30); };



  const updateMixedEntry = (index: number, field: keyof MixedEntry, value: string | number) => {
    setMixedPayments(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  };

  const addMixedEntry = () => {
    setMixedPayments(prev => [...prev, { method: "pago-movil", amountBs: 0, amountUsd: 0, reference: "" }]);
  };

  const removeMixedEntry = (index: number) => {
    if (mixedPayments.length <= 2) return;
    setMixedPayments(prev => prev.filter((_, i) => i !== index));
  };

  // View mode for products: grid or list
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const methodLabels: Record<string, string> = {
    efectivo: "Efectivo (Bs)",
    'efectivo-usd': "Efectivo ($)",
    transferencia: "Transferencia",
    "pago-movil": "Pago Movil",
    'punto-de-venta': 'Punto de Venta',
    cashea: "Cashea",
    zelle: "Zelle ($)",
    usdt: "USDT ($)",
  };

  // Placeholder dinamico para campo de referencia segun metodo
  const getRefPlaceholder = (method: string) => {
    const m = method.toLowerCase();
    if (m === 'zelle') return 'Nombre titular / Email';
    if (m === 'usdt') return 'Email o ID transferencia';
    return 'Ej: 12345678901234567890';
  };
  const getRefLabel = (method: string) => {
    const m = method.toLowerCase();
    if (m === 'zelle') return 'Nombre Titular (email/tel opcional)';
    if (m === 'usdt') return 'Email o ID de Transferencia';
    return 'Numero de Referencia';
  };

  // ===== PRINT TICKET (delegado a utilidad compartida — dual ESC/POS + HTML) =====
  const printTicket = async (receipt: any) => {
    const ticketSettings: TicketSettings = {
      storeName, storeRif, storeAddress, storePhone,
      ticketFontSize, ticketFontFamily, ticketBold,
      ticketShowPhone, ticketShowSeller, ticketShowExchange, ticketShowSlogan,
      ticketPaperWidth, ticketMarginLeft, ticketMarginRight,
      ticketHeaderMsg, ticketFooterMsg,
      ticketUseAgent: ticketUseAgent ?? true,
      ticketAgentUrl: ticketAgentUrl || 'http://localhost:9100',
      ticketCurrencyMode: ticketCurrencyMode || 'dual',
    };
    try {
      const ok = await _printTicket({ receipt, settings: ticketSettings, currency, defaultSellerName: sellerName });
      if (!ok) toast.error('No se pudo abrir ventana de impresion. Permita ventanas emergentes.');
    } catch (e: any) {
      toast.error('Impresion: ' + (e.message || 'desconocido'), { duration: 8000 });
    }
  };

  const completeSale = async () => {
    if (isSubmittingRef.current) return;
    if (cart.length === 0) { toast.error("El carrito esta vacio"); return; }
    if (total <= 0) { toast.error("El total debe ser mayor a cero"); return; }
    if (!bcvRate || bcvRate <= 0) { toast.error("La tasa de cambio no esta configurada. Vaya a Configuracion."); return; }
    if (effectiveDiscount > subtotal) { toast.error("Descuento mayor al subtotal"); return; }
    // Validate credit sale
    if (isCredit) {
      if (!creditClientId) { toast.error("Debe seleccionar un cliente para la venta a credito"); return; }
      // Check credit limit
      const selClient = clients.find(c => c.id === creditClientId);
      const clientLimit = selClient?.creditLimit ?? 0;
      const newTotal = (selClient?.creditBalance ?? 0) + total;
      if (clientLimit > 0 && newTotal > clientLimit) {
        toast.error(`Limite de credito excedido. Deuda actual: $${(selClient?.creditBalance || 0).toFixed(2)} + Venta: $${total.toFixed(2)} = $${newTotal.toFixed(2)} (Limite: $${clientLimit.toFixed(2)})`);
        return;
      }
      // Confirm if client already has debt
      if (creditClientDebt > 0 && !skipDebtConfirmRef.current) {
        setShowCreditConfirm(true);
        return;
      }
      skipDebtConfirmRef.current = false;
    }
    // Validate cash payment Bs (vuelto)
    if (!isCredit && paymentMethod === "efectivo" && parseFloat(cashReceived || "0") < totalBs) {
      toast.error(`Efectivo insuficiente. Total: Bs ${totalBs.toFixed(2)}, Recibido: Bs ${(parseFloat(cashReceived || "0")).toFixed(2)}. Falta: Bs ${(totalBs - parseFloat(cashReceived || "0")).toFixed(2)}`);
      return;
    }
    // Validate cash payment USD (vuelto)
    if (!isCredit && paymentMethod === "efectivo-usd" && parseFloat(cashReceivedUsd || "0") < total) {
      toast.error(`Efectivo insuficiente. Total: $${total.toFixed(2)}, Recibido: $${(parseFloat(cashReceivedUsd || "0")).toFixed(2)}. Falta: $${(total - parseFloat(cashReceivedUsd || "0")).toFixed(2)}`);
      return;
    }
    // Validate reference number for required methods (skip for credit sales)
    if (!isCredit && showRefField && paymentMethod !== "mixto" && !referenceNumber.trim()) {
      toast.error("Debe ingresar el numero de referencia de la transaccion"); return;
    }
    // Validate mixed payment (skip for credit sales)
    if (!isCredit && paymentMethod === "mixto") {
      const filledEntries = mixedPayments.filter(e => e.amountBs > 0);
      if (filledEntries.length < 2) { toast.error("En pago mixto debe usar al menos 2 metodos de pago"); return; }
      if (!isMixedValid) { toast.error(`El desglose no coincide con el total. Faltan Bs ${mixedRemaining.toFixed(2)} ($ ${mixedRemainingUsd.toFixed(2)})`); return; }
      const needsRef = filledEntries.filter(e => ["transferencia", "pago-movil", "zelle", "usdt"].includes(e.method) && !e.reference.trim());
      if (needsRef.length > 0) { toast.error("Los metodos Transferencia, Pago Movil, Zelle y USDT requieren referencia"); return; }
    }
    // Validar que los productos por peso tengan peso ingresado
    const sinPeso = cart.filter(i => i.vendePorPeso && (!i.pesoIngresado || i.quantity <= 0));
    if (sinPeso.length > 0) { toast.error(`Ingrese el peso para: ${sinPeso.map(i => i.name).join(", ")}`); return; }
    if (!allowZeroStock) {
      const insufficient = cart.filter(i => { const p = products.find(pp => pp.id === i.id); return p && i.quantity > p.stock; });
      if (insufficient.length > 0) { toast.error(`Stock insuficiente: ${insufficient.map(i => i.name).join(", ")}`); return; }
    }
    // Build mixed payment JSON
    let mixedJson = "";
    if (paymentMethod === "mixto") {
      const validEntries = mixedPayments.filter(e => e.amountBs > 0);
      mixedJson = JSON.stringify(validEntries.map(e => ({ method: e.method, amountBs: e.amountBs, amountUsd: e.amountUsd, reference: e.reference })))
        .replace(/'/g, "''");
    }
    // Build reference for non-mixed
    const saleRef = paymentMethod === "mixto" ? "" : referenceNumber.trim();
    try {
      isSubmittingRef.current = true;
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal, taxAmount, discount: effectiveDiscount, total, totalBs,
          exchangeRate: bcvRate, paymentMethod, referenceNumber: saleRef, mixedPaymentJson: mixedJson,
          sellerName, sellerRole, notes,
          isCredit: isCredit,
          creditPaid: isCredit ? 0 : undefined,
          creditDays: isCredit ? creditDays : undefined,
          clientId: isCredit && creditClientId ? creditClientId : selectedClient?.id || null,
          clientDocType: isCredit ? (clients.find(c => c.id === creditClientId)?.docType || '') : selectedClient?.docType || "",
          clientDocNumber: isCredit ? (clients.find(c => c.id === creditClientId)?.docNumber || '') : selectedClient?.docNumber || "",
          clientName: isCredit ? creditClientName : selectedClient?.fullName || "",
          clientAddress: isCredit ? (clients.find(c => c.id === creditClientId)?.address || '') : selectedClient?.address || "",
          customerName: isCredit ? creditClientName : selectedClient?.fullName || "",
          items: cart.map((item) => ({
            productId: item.id, productName: item.name,
            quantity: item.quantity, unitPrice: item.price, total: item.total,
          })),
        }),
      });
      const sale = await res.json();
      if (!res.ok) {
        if (sale.code === 'INSUFFICIENT_STOCK') { setShowStockWarning(sale); return; }
        throw new Error(sale.error);
      }
      setShowReceipt({ ...sale, paymentMethod, notes, client: selectedClient, referenceNumber: saleRef, mixedPaymentJson: mixedJson,
        cashReceived: paymentMethod === 'efectivo' ? parseFloat(cashReceived || '0') : paymentMethod === 'efectivo-usd' ? parseFloat(cashReceivedUsd || '0') : 0,
        vuelto: paymentMethod === 'efectivo' ? vuelto : paymentMethod === 'efectivo-usd' ? vueltoUsd : 0,
      });
      if (isCredit) {
        toast.success(`Venta a credito registrada a ${creditClientName} — $${total.toFixed(2)}`);
      } else {
        toast.success("Venta registrada exitosamente");
      }
      clearCart();
      if (onSaleComplete) onSaleComplete();
    } catch (error: any) { toast.error(error.message || "Error al registrar venta"); } finally { isSubmittingRef.current = false; }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full">
      {/* ====== CARRITO (3/5) ====== */}
      <Card className="lg:col-span-3 flex flex-col h-full border-2 border-primary/30 shadow-lg">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-lg font-bold">Carrito <span className="text-primary">({cart.length})</span></CardTitle>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowQrModal(true)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[10px] border border-indigo-200 hover:bg-indigo-200 transition-colors" title="Acceso movil via QR">
                Telefono QR
              </button>
              {cart.length > 0 && <Button variant="destructive" size="sm" onClick={clearCart} className="text-xs h-7">Vaciar</Button>}
            </div>
          </div>
          {/* ====== BARRA DE ATAJOS F-KEY ====== */}
          <div className="flex flex-wrap gap-1.5 bg-muted/60 rounded-lg px-3 py-1.5">
            <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 font-bold text-xs border border-blue-200 shadow-sm"><span className="text-[10px] opacity-70">F2</span> Buscar</kbd>
            <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 shadow-sm"><span className="text-[10px] opacity-70">F4</span> Credito</kbd>
            <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-100 text-green-800 font-bold text-xs border border-green-200 shadow-sm"><span className="text-[10px] opacity-70">F5</span> Efectivo$</kbd>
            <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 shadow-sm"><span className="text-[10px] opacity-70">F6</span> Efectivo</kbd>
            <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200 shadow-sm"><span className="text-[10px] opacity-70">F7</span> PMovil</kbd>
            <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-100 text-red-800 font-bold text-xs border border-red-200 shadow-sm"><span className="text-[10px] opacity-70">F8</span> COBRAR</kbd>
            <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-bold text-xs border border-gray-200 shadow-sm"><span className="text-[10px] opacity-70">Esc</span> Vaciar</kbd>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden px-4 pb-4">
          {/* Cliente seleccionado */}
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">CLIENTE</p>
                <p className="text-lg font-semibold truncate">
                  {selectedClient ? selectedClient.fullName : "Sin cliente"}
                  {selectedClient && <span className="text-muted-foreground ml-2 text-sm">({selectedClient.docType}-{selectedClient.docNumber})</span>}
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-9 text-sm font-medium px-4" onClick={() => setShowClientDialog(true)}>
                Cambiar
              </Button>
            </div>
          </div>

          {/* Items del carrito */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {cart.map((item) => {
              const product = products.find((p) => p.id === item.id);
              const isOver = product && !allowZeroStock && item.quantity > product.stock;
              return (
                <div key={item.id} className={`flex items-center gap-2 p-2 rounded-xl border-2 text-sm ${isOver ? "border-red-400 bg-red-50" : item.isWholesale ? "border-emerald-400 bg-emerald-50/50" : "bg-muted/40 border-muted"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-xs">
                      {item.name}
                      {item.isWholesale && <span className="text-emerald-600 text-[9px] ml-1 font-bold">MAYORISTA</span>}
                      {item.vendePorPeso ? <span className="text-orange-600 text-[9px] ml-1">({item.unidadPeso || 'kg'})</span> : ''}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {currency} {item.price.toFixed(2)}{item.vendePorPeso ? `/${item.unidadPeso || 'kg'}` : ''}
                      {item.isWholesale && product && (
                        <span className="line-through ml-1 text-red-400 text-[10px]">${(product.price || 0).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="w-6 h-6 rounded border flex items-center justify-center hover:bg-accent text-sm font-bold" onClick={() => updateQuantity(item.id, item.quantity - (item.vendePorPeso ? 0.1 : 1))}>-</button>
                    <input type="number" min="0" step={item.vendePorPeso ? "0.01" : "1"} value={item.quantity} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) updateQuantity(item.id, v); }} className={`w-12 text-center font-medium bg-transparent border-b border-transparent focus:border-primary text-xs h-6 p-0 ${item.vendePorPeso && !item.pesoIngresado ? 'border-orange-400 animate-pulse' : ''}`} />
                    <button className="w-6 h-6 rounded border flex items-center justify-center hover:bg-accent text-sm font-bold" onClick={() => updateQuantity(item.id, item.quantity + (item.vendePorPeso ? 0.1 : 1))}>+</button>
                  </div>
                  <div className="text-right w-16 font-bold text-xs">{currency} {item.total.toFixed(2)}</div>
                  <div className="flex flex-col gap-0.5">
                    {product && product.wholesalePrice > 0 && (
                      <button
                        onClick={() => toggleWholesale(item.id)}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${item.isWholesale ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-gray-100 text-gray-500 border-gray-300'} hover:opacity-80`}
                        title={item.isWholesale ? "Cambiar a precio detal" : "Cambiar a precio mayorista"}
                      >
                        {item.isWholesale ? "MAYOR" : "DEAL"}
                      </button>
                    )}
                    <button className="text-destructive hover:underline text-lg px-1 leading-none" onClick={() => removeFromCart(item.id)}>&#10005;</button>
                  </div>
                </div>
              );
            })}
            {cart.length === 0 && <div className="text-center text-muted-foreground py-16 text-xl">Agregue productos al carrito</div>}
          </div>

          <Separator />

          {/* Pago y opciones */}
          <div className="space-y-3">
            <Select value={paymentMethod} onChange={(e: any) => { setPaymentMethod(e.target.value); setReferenceNumber(""); }} className="h-12 text-base font-medium">
              <option value="efectivo">Efectivo (Bs)</option>
              <option value="efectivo-usd">Efectivo ($)</option>
              <option value="cashea">Cashea</option>
              <option value="transferencia">Transferencia</option>
              <option value="pago-movil">Pago Movil</option>
              <option value="punto-de-venta">Punto de Venta</option>
              <option value="zelle">Zelle ($)</option>
              <option value="usdt">USDT ($)</option>
              <option value="mixto">Mixto (varios metodos)</option>
            </Select>

            {/* Campo de vuelto para efectivo Bs */}
            {paymentMethod === "efectivo" && !isCredit && cart.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm font-medium">Efectivo Recibido (Bs)</Label>
                <Input ref={cashInputRef} type="number" min="0" step="0.01" value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Monto recibido del cliente"
                  className="h-11 text-lg font-bold" />
                {cashReceived && (
                  <div className={`p-3 rounded-lg border-2 text-center ${vuelto >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                    {vuelto >= 0 ? (
                      <p className="text-xl font-bold text-green-700">Vuelto: Bs {vuelto.toFixed(2)}</p>
                    ) : (
                      <p className="text-base font-bold text-red-600">Falta: Bs {Math.abs(vuelto).toFixed(2)}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Campo de vuelto para efectivo USD */}
            {paymentMethod === "efectivo-usd" && !isCredit && cart.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm font-medium">Efectivo Recibido ($)</Label>
                <Input ref={cashUsdInputRef} type="number" min="0" step="0.01" value={cashReceivedUsd}
                  onChange={(e) => setCashReceivedUsd(e.target.value)}
                  placeholder="Monto recibido en dolares"
                  className="h-11 text-lg font-bold" />
                <p className="text-xs text-muted-foreground">Equivalente en Bs: {(parseFloat(cashReceivedUsd || "0") * bcvRate).toFixed(2)}</p>
                {cashReceivedUsd && (
                  <div className={`p-3 rounded-lg border-2 text-center ${vueltoUsd >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                    {vueltoUsd >= 0 ? (
                      <p className="text-xl font-bold text-green-700">Vuelto: ${vueltoUsd.toFixed(2)}</p>
                    ) : (
                      <p className="text-base font-bold text-red-600">Falta: ${Math.abs(vueltoUsd).toFixed(2)}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Campo de referencia para metodos que lo requieren */}
            {showRefField && paymentMethod !== "mixto" && (
              <div>
                <Label className="text-sm font-medium">{getRefLabel(paymentMethod)} *</Label>
                <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder={getRefPlaceholder(paymentMethod)}
                  className="h-10 text-base font-mono" />
              </div>
            )}

            {/* Desglose de pago mixto */}
            {paymentMethod === "mixto" && (
              <div className="space-y-2 p-3 border rounded-lg bg-blue-50/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-blue-800">Desglose de Pago Mixto</Label>
                  <Badge variant={isMixedValid ? "default" : "destructive"} className="text-xs px-3 py-1">
                    {isMixedValid ? "COMPLETO" : `FALTAN Bs ${mixedRemaining.toFixed(2)} ($ ${mixedRemainingUsd.toFixed(2)})`}
                  </Badge>
                </div>
                {mixedPayments.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-1 p-2 bg-background rounded border">
                    <select value={entry.method}
                      onChange={(e) => updateMixedEntry(idx, "method", e.target.value)}
                      className="h-9 text-xs rounded border px-2 flex-shrink-0 w-28">
                      <option value="efectivo">Efectivo</option>
                      <option value="efectivo-usd">Efectivo ($)</option>
                      <option value="cashea">Cashea</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="pago-movil">Pago Movil</option>
                      <option value="punto-de-venta">Punto de Venta</option>
                      <option value="zelle">Zelle ($)</option>
                      <option value="usdt">USDT ($)</option>
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{['efectivo-usd', 'zelle', 'usdt'].includes(entry.method) ? '$' : 'Bs'}</span>
                      <Input type="number" min="0" step="0.01" value={['efectivo-usd', 'zelle', 'usdt'].includes(entry.method) ? (entry.amountUsd || '') : (entry.amountBs || '')}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          if (['efectivo-usd', 'zelle', 'usdt'].includes(entry.method)) {
                            updateMixedEntry(idx, "amountUsd", val);
                            updateMixedEntry(idx, "amountBs", parseFloat((val * bcvRate).toFixed(2)));
                          } else {
                            updateMixedEntry(idx, "amountBs", val);
                            updateMixedEntry(idx, "amountUsd", parseFloat((val / bcvRate).toFixed(2)));
                          }
                        }}
                        placeholder="0.00" className="h-9 text-xs pl-8" />
                    </div>
                    {["transferencia", "pago-movil", "zelle", "usdt"].includes(entry.method) && (
                      <Input value={entry.reference}
                        onChange={(e) => updateMixedEntry(idx, "reference", e.target.value)}
                        placeholder={getRefPlaceholder(entry.method)} className="h-9 text-xs font-mono w-28 flex-shrink-0" />
                    )}
                    {mixedPayments.length > 2 && (
                      <button onClick={() => removeMixedEntry(idx)}
                        className="text-destructive hover:text-red-700 text-sm flex-shrink-0 px-1">X</button>
                    )}
                  </div>
                ))}
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={addMixedEntry} className="h-7 text-xs">
                    + Agregar metodo
                  </Button>
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total desglose:</span><span className={isMixedValid ? "text-green-700 font-bold" : "text-red-600 font-bold"}>Bs {mixedTotalBs.toFixed(2)}</span></div>
                  {!isMixedValid && <p className="text-red-600">Restante: Bs {mixedRemaining.toFixed(2)} ($ {mixedRemainingUsd.toFixed(2)})</p>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Total venta:</span><span>Bs {totalBs.toFixed(2)}</span></div>
                </div>
              </div>
            )}

            {enableDiscount && (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Descuento ($):</span>
                  <Input type="number" min="0" step="0.01" max={subtotal * (maxDiscountPct / 100)} value={discount || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setDiscount(v > subtotal * maxDiscountPct / 100 ? subtotal * maxDiscountPct / 100 : v); }} className="h-10 text-base" />
                </div>
              </div>
            )}
            {canSaleNotes && (
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" className="h-14 text-sm" />
            )}

            {/* Credito - SECCION DESTACADA */}
            <div className={`border-2 rounded-xl p-4 transition-all ${isCredit ? 'border-amber-400 bg-amber-50 shadow-md' : 'border-muted bg-muted/30'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCredit}
                  onChange={(e) => {
                    setIsCredit(e.target.checked);
                    if (!e.target.checked) { setCreditClientId(""); setCreditClientName(""); }
                  }}
                  className="h-6 w-6 rounded border-primary"
                />
                <span className={`text-lg font-bold flex items-center gap-2 ${isCredit ? 'text-amber-700' : ''}`}>
                  VENTA A CREDITO
                </span>
                {isCredit && <span className="ml-auto px-3 py-1 bg-amber-200 text-amber-800 rounded-lg text-sm font-bold">ACTIVO</span>}
              </label>
              {isCredit && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-yellow-600 font-medium">Se registrara como deuda del cliente. La venta NO genera cobro en caja.</p>
                  <div className="flex gap-2">
                    <select
                      value={creditClientId}
                      onChange={(e) => {
                        setCreditClientId(e.target.value);
                        const sel = clients.find(c => c.id === e.target.value);
                        setCreditClientName(sel?.fullName || '');
                        setCreditClientDebt(sel?.creditBalance || 0);
                      }}
                      className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Seleccionar Cliente...</option>
                      {clients.filter(c => !c.isFinalClient).map(c => (
                        <option key={c.id} value={c.id}>{c.fullName} ({c.docType}-{c.docNumber}){c.creditBalance && c.creditBalance > 0 ? ` — DEBE $${c.creditBalance.toFixed(2)}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {creditClientId && (
                    <div className={`p-3 rounded-lg border-2 text-base font-semibold ${creditClientDebt > 0 ? 'bg-red-50 border-red-400 text-red-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
                      Se registrara deuda a: <strong>{creditClientName}</strong>
                      {creditClientDebt > 0 && <><br />Este cliente ya debe: <strong className="text-lg">${creditClientDebt.toFixed(2)} (Bs {(creditClientDebt * bcvRate).toFixed(2)})</strong></>}
                    </div>
                  )}
                  {creditClientId && creditClientDebt > 0 && (
                    <div className="p-3 rounded-lg border-2 text-base bg-red-100 border-red-500 text-red-900 font-black text-center">
                      CLIENTE CON DEUDA PENDIENTE: ${creditClientDebt.toFixed(2)} — Bs {(creditClientDebt * bcvRate).toFixed(2)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Label className="text-sm whitespace-nowrap">Plazo credito:</Label>
                    <Input type="number" min="1" max="365" value={creditDays}
                      onChange={(e) => setCreditDays(parseInt(e.target.value) || 30)}
                      className="w-20 h-9 text-center text-sm" />
                    <span className="text-sm text-muted-foreground">dias</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Resumen - MAS GRANDE */}
          <div className="space-y-2 text-lg">
            {isUsdMethod ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-semibold">${subtotal.toFixed(2)}</span></div>
                {taxRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IVA ({taxRate}%):</span><span>${taxAmount.toFixed(2)}</span></div>}
                {effectiveDiscount > 0 && <div className="flex justify-between text-destructive"><span>Descuento:</span><span>-${effectiveDiscount.toFixed(2)}</span></div>}
              </>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-semibold">Bs {(subtotal * bcvRate).toFixed(2)}</span></div>
                {taxRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IVA ({taxRate}%):</span><span>Bs {(taxAmount * bcvRate).toFixed(2)}</span></div>}
                {effectiveDiscount > 0 && <div className="flex justify-between text-destructive"><span>Descuento:</span><span>-Bs {(effectiveDiscount * bcvRate).toFixed(2)}</span></div>}
              </>
            )}
            {isUsdMethod ? (
              <>
                <div className="flex justify-between text-3xl font-black text-primary"><span>Total:</span><span>${total.toFixed(2)}</span></div>
                <div className="flex justify-between text-base text-muted-foreground"><span>Equivalente Bs:</span><span className="font-semibold">Bs {totalBs.toFixed(2)}</span></div>
                <div className="text-sm text-muted-foreground">Tasa: 1$ = {bcvRate.toFixed(2)} Bs</div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-3xl font-black text-primary"><span>Total:</span><span>Bs {totalBs.toFixed(2)}</span></div>
                <div className="flex justify-between text-base text-muted-foreground"><span>Total USD:</span><span className="font-semibold">${total.toFixed(2)}</span></div>
                <div className="text-sm text-muted-foreground">Tasa: 1$ = {bcvRate.toFixed(2)} Bs</div>
              </>
            )}
          </div>

          <Button className="w-full mt-2 text-xl py-6 font-black tracking-wide rounded-xl" size="lg" onClick={completeSale} disabled={cart.length === 0}>
          {isCredit ? 'Registrar Credito $' + total.toFixed(2) : isUsdMethod ? 'Cobrar $ ' + total.toFixed(2) : 'Cobrar Bs ' + totalBs.toFixed(2)}
          </Button>
        </CardContent>
      </Card>

      {/* ====== PANEL DE PRODUCTOS (2/5) ====== */}
      <div className="lg:col-span-2 flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Input ref={searchInputRef} placeholder="Buscar... (F2)" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-20 h-10 text-sm" />
            <div className="absolute right-1 top-1 flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-sm" title="Acceso movil via QR" onClick={() => setShowQrModal(true)}>
                &#128241;
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-sm" title="Escanear codigo de barras" onClick={() => startScanner("product")}>
                &#128247;
              </Button>
            </div>
          </div>
          <Select value={selectedCategory} onChange={(e: any) => setSelectedCategory(e.target.value)} className="h-10 text-sm">
            <option value="">Todas</option>
            {categories.map((cat: any) => (
              <option key={cat.name} value={cat.name}>
                {cat.icon ? cat.icon + ' ' : ''}{cat.name}
              </option>
            ))}
          </Select>
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

        {/* Grid View - ultra compacto */}
        {viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-1 overflow-y-auto max-h-[72vh] p-0.5">
          {filteredProducts.map((product) => {
            const isOut = product.stock <= 0;
            const isLow = product.stock > 0 && product.stock <= (product.minStock || 5);
            return (
              <button key={product.id} onClick={() => addToCart(product)}
                disabled={!allowZeroStock && isOut}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                  isOut && !allowZeroStock ? "bg-red-50 border-red-300 opacity-50 cursor-not-allowed"
                  : isOut && allowZeroStock ? "bg-orange-50 border-orange-300"
                  : isLow ? "bg-yellow-50 border-yellow-300"
                  : "bg-card border-muted hover:bg-accent hover:border-primary/40"
                }`}>
                {product.icon && <span className="text-base flex-shrink-0">{product.icon}</span>}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium leading-tight block truncate">{product.name}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{currency}{product.price.toFixed(2)}{product.vendePorPeso && product.unidadPeso ? `/${product.unidadPeso}` : ''}</span>
                  <span className="text-[9px] text-muted-foreground block">Bs{(product.price * bcvRate).toFixed(0)}</span>
                </div>
                <Badge variant={isOut ? "destructive" : isLow ? "warning" : "secondary"} className="flex-shrink-0 text-[9px] px-1.5 py-0">
                  {product.stock}
                </Badge>
              </button>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">No se encontraron productos</div>
          )}
        </div>
        )}
        {/* List View - ultra compacto */}
        {viewMode === "list" && (
        <div className="overflow-y-auto max-h-[72vh] p-0.5 space-y-0.5">
          {filteredProducts.map((product) => {
            const isOut = product.stock <= 0;
            const isLow = product.stock > 0 && product.stock <= (product.minStock || 5);
            return (
              <button key={product.id} onClick={() => addToCart(product)}
                disabled={!allowZeroStock && isOut}
                className={`flex items-center gap-2 w-full p-2 rounded-lg border transition-all text-left ${
                  isOut && !allowZeroStock ? "bg-red-50 border-red-300 opacity-50 cursor-not-allowed"
                  : isOut && allowZeroStock ? "bg-orange-50 border-orange-300"
                  : isLow ? "bg-yellow-50 border-yellow-300"
                  : "bg-card border-muted hover:bg-accent hover:border-primary/40"
                }`}>
                {product.icon && <span className="text-base flex-shrink-0">{product.icon}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{product.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-primary">{currency}{product.price.toFixed(2)}{product.vendePorPeso && product.unidadPeso ? `/${product.unidadPeso}` : ''}</p>
                  <p className="text-[9px] text-muted-foreground">Bs{(product.price * bcvRate).toFixed(0)}</p>
                </div>
                <Badge variant={isOut ? "destructive" : isLow ? "warning" : "secondary"} className="flex-shrink-0 text-[9px] px-1.5 py-0">
                  {product.stock}
                </Badge>
              </button>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">No se encontraron productos</div>
          )}
        </div>
        )}
      </div>

      {/* ====== MODAL SCANNER ====== */}
      <Dialog open={showScanner} onOpenChange={(open) => { if (!open) stopScanner(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              &#128247; Escanear Codigo de Barras / QR
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Loading state */}
            {scannerLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Iniciando camara...</p>
              </div>
            )}

            {/* Error state */}
            {scannerError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-lg flex-shrink-0">&#9888;</span>
                  <div className="text-sm text-red-700 space-y-2">
                    <p className="font-semibold">Error con la camara</p>
                    <p>{scannerError}</p>
                    <div className="text-xs text-red-600 bg-red-100 rounded p-2 mt-2">
                      <p className="font-semibold mb-1">Pasos para solucionar:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Haga clic en el icono de candado o camara en la barra de direccion del navegador</li>
                        <li>Busque "Camara" y seleccione "Permitir"</li>
                        <li>Recargue la pagina (F5) e intente de nuevo</li>
                        <li>Si usa Chrome: vaya a Configuracion &gt; Privacidad y seguridad &gt; Configuracion de sitios &gt; Camara</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={stopScanner}>Cerrar</Button>
                  <Button className="flex-1" onClick={() => startScanner(scannerMode)}>Reintentar</Button>
                </div>
              </div>
            )}

            {/* Scanner area (hidden div for html5-qrcode) */}
            {!scannerLoading && !scannerError && (
              <>
                <div
                  id={scannerDivRef.current}
                  className="rounded-lg overflow-hidden"
                  style={{ minHeight: "250px" }}
                />
                {/* Custom styles to hide the html5-qrcode default UI elements we don't want */}
                <style>{`
                  #${scannerDivRef.current} img[alt="Info icon"] { display: none !important; }
                  #${scannerDivRef.current} button { display: none !important; }
                  #${scannerDivRef.current} #qr-shaded-region { border-color: rgba(34,197,94,0.5) !important; }
                `}</style>
                <p className="text-xs text-center text-muted-foreground">
                  Apunte la camara hacia el codigo de barras o QR.
                </p>
              </>
            )}

            {/* Manual input (always visible) */}
            <p className="text-xs text-center text-muted-foreground">
              Tambien puede escribir el codigo manualmente:
            </p>
            <Input placeholder="Escribir codigo manualmente..." value={search} onChange={(e) => {
              setSearch(e.target.value);
              const val = e.target.value;
              if (val) {
                const f = products.find(p => p.barcode === val);
                if (f) {
                  stopScanner();
                  addToCart(f);
                  toast.success("Producto: " + f.name);
                  setSearch("");
                }
              }
            }} className="font-mono text-center" />
            <Button variant="outline" className="w-full" onClick={stopScanner}>Cerrar Scanner</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL SELECCION CLIENTE ====== */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={selectFinalClient}>
                Cliente Final
              </Button>
              <Button variant="outline" className="flex-1 text-xs" onClick={selectNoClient}>
                Sin Cliente
              </Button>
              <Button variant="outline" className="flex-1 text-xs" onClick={() => { setShowClientDialog(false); setShowNewClientDialog(true); }}>
                + Nuevo
              </Button>
            </div>
            <Separator />
            <Input placeholder="Buscar por nombre, cedula, RIF..." value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); searchClients(e.target.value); }} />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {clientResults.map((client) => (
                <button key={client.id} onClick={() => selectClient(client)} className="w-full flex items-center justify-between p-2 rounded border hover:bg-muted text-left text-xs">
                  <div>
                    <p className="font-medium">{client.fullName}</p>
                    <p className="text-muted-foreground">{client.docType}-{client.docNumber} {client.phone ? `| ${client.phone}` : ""}</p>
                  </div>
                  <Badge variant={client.isFinalClient ? "secondary" : "default"} className="text-[8px]">
                    {client.isFinalClient ? "FINAL" : client.type === "natural" ? "NAT" : "JUR"}
                  </Badge>
                </button>
              ))}
              {clientResults.length === 0 && clientSearch.length > 0 && (
                <p className="text-center text-muted-foreground text-xs py-4">No se encontraron clientes</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL NUEVO CLIENTE ====== */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Cliente Nuevo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setNewClientForm({ ...newClientForm, type: "natural", docType: "V" })} className={`flex-1 p-2 rounded border text-xs font-medium ${newClientForm.type === "natural" ? "bg-primary text-primary-foreground" : ""}`}>Natural</button>
              <button type="button" onClick={() => setNewClientForm({ ...newClientForm, type: "juridico", docType: "J" })} className={`flex-1 p-2 rounded border text-xs font-medium ${newClientForm.type === "juridico" ? "bg-primary text-primary-foreground" : ""}`}>Juridico</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tipo Doc</Label>
                <select value={newClientForm.docType} onChange={(e) => setNewClientForm({ ...newClientForm, docType: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs">
                  {newClientForm.type === "natural" ? <><option value="V">V</option><option value="E">E</option><option value="P">P</option></> : <><option value="J">J</option><option value="G">G</option><option value="V">V</option></>}
                </select>
              </div>
              <div>
                <Label className="text-xs">Numero *</Label>
                <Input value={newClientForm.docNumber} onChange={(e) => setNewClientForm({ ...newClientForm, docNumber: e.target.value.toUpperCase() })} className="h-9 text-xs" />
              </div>
            </div>
            {newClientForm.type === "natural" ? (
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Nombre *</Label><Input value={newClientForm.firstName} onChange={(e) => setNewClientForm({ ...newClientForm, firstName: e.target.value })} className="h-9 text-xs" /></div>
                <div><Label className="text-xs">Apellido *</Label><Input value={newClientForm.lastName} onChange={(e) => setNewClientForm({ ...newClientForm, lastName: e.target.value })} className="h-9 text-xs" /></div>
              </div>
            ) : (
              <div><Label className="text-xs">Razon Social *</Label><Input value={newClientForm.businessName} onChange={(e) => setNewClientForm({ ...newClientForm, businessName: e.target.value })} className="h-9 text-xs" /></div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Telefono</Label><Input value={newClientForm.phone} onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Email</Label><Input value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} className="h-9 text-xs" /></div>
            </div>
            <div><Label className="text-xs">Direccion</Label><Input value={newClientForm.address} onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })} className="h-9 text-xs" /></div>
            <Button className="w-full" onClick={createQuickClient}>Registrar y Seleccionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL RECIBO ====== */}
      <Dialog open={!!showReceipt} onOpenChange={() => setShowReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Venta Completada</DialogTitle>
          </DialogHeader>
          {showReceipt && (
            <div className="text-center space-y-3 text-sm">
              <p className="font-bold text-lg">{storeName}</p>
              {storeRif && <p className="text-xs text-muted-foreground">RIF: {storeRif}</p>}
              {storeAddress && <p className="text-xs text-muted-foreground">{storeAddress}</p>}
              <p className="text-muted-foreground text-xs">{new Date(showReceipt.date).toLocaleString("es-VE")}</p>
              <Separator />
              {/* Datos del cliente en factura */}
              {showReceipt.clientName && showReceipt.clientName !== "CLIENTE FINAL" && (
                <div className="text-left bg-muted/30 p-2 rounded text-xs space-y-0.5">
                  <p className="font-bold">Cliente:</p>
                  <p>{showReceipt.clientName}</p>
                  {showReceipt.clientDocNumber && <p>CI/RIF: {showReceipt.clientDocType}-{showReceipt.clientDocNumber}</p>}
                  {showReceipt.clientAddress && <p>Direccion: {showReceipt.clientAddress}</p>}
                </div>
              )}
              {showReceipt.clientName === "CLIENTE FINAL" && (
                <div className="text-left bg-muted/30 p-2 rounded text-xs">
                  <p>Consumidor Final: {showReceipt.clientDocType}-{showReceipt.clientDocNumber}</p>
                </div>
              )}
              <p>Metodo de pago: {showReceipt.paymentMethod === "mixto" ? "Mixto" : showReceipt.paymentMethod}</p>
              {/* Numero de referencia en recibo */}
              {showReceipt.referenceNumber && (
                <div className="text-left bg-muted/30 p-2 rounded text-xs">
                  <p className="font-medium">Referencia:</p>
                  <p className="font-mono">{showReceipt.referenceNumber}</p>
                </div>
              )}
              {/* Desglose de pago mixto en recibo */}
              {showReceipt.paymentMethod === "mixto" && showReceipt.mixedPaymentJson && (() => {
                try {
                  const entries = JSON.parse(showReceipt.mixedPaymentJson);
                  return (
                    <div className="text-left bg-blue-50 p-2 rounded text-xs space-y-1">
                      <p className="font-bold text-blue-800">Desglose de Pago:</p>
                      {entries.map((e: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span>{methodLabels[e.method] || e.method}:</span>
                          <span>Bs {parseFloat(e.amountBs).toFixed(2)} (${parseFloat(e.amountUsd).toFixed(2)})</span>
                        </div>
                      ))}
                      {entries.some((e: any) => e.reference) && (
                        <div className="mt-1 pt-1 border-t">
                          {entries.filter((e: any) => e.reference).map((e: any, i: number) => (
                            <p key={i} className="text-muted-foreground">{methodLabels[e.method]} Ref: <span className="font-mono">{e.reference}</span></p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } catch { return null; }
              })()}
              <Separator />
              <div className="text-left space-y-1">
                <div className="flex justify-between text-xs font-bold border-b pb-1 mb-1">
                  <span style={{width:'40%'}}>Producto</span>
                  <span style={{width:'10%',textAlign:'center'}}>Cant.</span>
                  <span style={{width:'18%',textAlign:'right'}}>P.Uni.</span>
                  <span style={{width:'4%'}}></span>
                  <span style={{width:'18%',textAlign:'right'}}>Total</span>
                </div>
                {showReceipt.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span style={{width:'40%',wordBreak:'break-word',overflowWrap:'break-word'}}>{item.product?.name || "Producto"}</span>
                    <span style={{width:'10%',textAlign:'center'}}>{item.quantity}</span>
                    <span style={{width:'18%',textAlign:'right'}}>${(item.unitPrice || 0).toFixed(2)}</span>
                    <span style={{width:'4%'}}></span>
                    <span style={{width:'18%',textAlign:'right'}}>${item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              {showReceipt.discount > 0 && <div className="flex justify-between text-destructive text-sm"><span>Descuento:</span><span>-${showReceipt.discount.toFixed(2)}</span></div>}
              <div className="text-lg font-bold">Total: Bs {showReceipt.totalBs.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Total USD: ${showReceipt.total.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Tasa: 1$ = {showReceipt.exchangeRate} Bs</p>
              <p className="text-xs font-bold text-muted-foreground">Factura N. {showReceipt.invoiceNumber || 'SIN ASIGNAR'}</p>
              <p className="text-[10px] text-muted-foreground">ID: {showReceipt.id.slice(0, 8)}</p>
              <div className="flex gap-2 mt-2">
                <Button className="flex-1" onClick={() => printTicket(showReceipt)}>&#128424; Imprimir Ticket</Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowReceipt(null)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ====== CREDIT CONFIRM DIALOG ====== */}
      <Dialog open={showCreditConfirm} onOpenChange={(open) => { if (!open) { setShowCreditConfirm(false); skipDebtConfirmRef.current = false; } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-amber-600">Confirmar Venta Fiada</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded">
              <p className="text-sm font-medium text-amber-800">Este cliente ya tiene deuda pendiente</p>
              <p className="text-lg font-bold text-amber-700 mt-1">${creditClientDebt.toFixed(2)}</p>
            </div>
            <div className="p-2 bg-muted rounded text-xs">
              <p>Venta actual: <strong>${total.toFixed(2)}</strong> = Bs <strong>{totalBs.toFixed(2)}</strong></p>
              <p className="text-muted-foreground">Nueva deuda total: <strong>${(creditClientDebt + total).toFixed(2)}</strong></p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowCreditConfirm(false); skipDebtConfirmRef.current = false; }}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={() => { setShowCreditConfirm(false); skipDebtConfirmRef.current = true; completeSale(); }}>
                Confirmar Credito
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL STOCK WARNING ====== */}
      <Dialog open={!!showStockWarning} onOpenChange={() => setShowStockWarning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-center text-destructive">Stock Insuficiente</DialogTitle></DialogHeader>
          {showStockWarning && (
            <div className="text-center space-y-3">
              <p className="text-sm">Producto sin stock suficiente:</p>
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="font-bold">{showStockWarning.productName}</p>
                <p className="text-xs text-muted-foreground">Disponible: {showStockWarning.availableStock} | Solicitado: {showStockWarning.requestedQuantity}</p>
              </div>
              <Button className="w-full" onClick={() => setShowStockWarning(null)}>Entendido</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ====== MODAL QR ACCESO MOVIL ====== */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Acceso Movil via QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground text-center">Escanea este codigo QR con la camara de tu telefono para acceder al TPV desde cualquier dispositivo de la red local.</p>
            {localUrl ? (
              <>
                <div className="p-4 bg-white rounded-xl border-2 shadow-sm">
                  <QRCodeSVG value={localUrl} size={200} level="H" includeMargin={false} />
                </div>
                <div className="text-center space-y-2 w-full">
                  <p className="text-xs text-muted-foreground">Direccion de acceso:</p>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <code className="flex-1 text-sm font-mono font-bold truncate">{localUrl}</code>
                    <Button variant="outline" size="sm" className="h-8 text-xs flex-shrink-0" onClick={() => { navigator.clipboard.writeText(localUrl); toast.success("URL copiada al portapapeles"); }}>
                      Copiar
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Solo accesible desde dispositivos conectados a la misma red WiFi/Local.</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Detectando IP local...</p>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => setShowQrModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
