"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PosTab from "@/components/pos-tab";
import ProductsTab from "@/components/products-tab";
import ConfigTab from "@/components/config-tab";
import ClientsTab from "@/components/clients-tab";
import DevolutionsTab from "@/components/devolutions-tab";
import CashClosingTab from "@/components/cash-closing-tab";
import LicenseTab from "@/components/license-tab";
import ReportsTab from "@/components/reports-tab";
import LoginScreen from "@/components/login-screen";
import ErrorBoundary from "@/components/error-boundary";
import UsersTab from "@/components/users-tab";
import BackupTab from "@/components/backup-tab";
import SuppliersTab from "@/components/suppliers-tab";
import PurchasesTab from "@/components/purchases-tab";
import CreditTab from "@/components/credit-tab";
import DashboardTab from "@/components/dashboard-tab";
import type { CurrentUser } from "@/components/users-tab";
import AppNav from "@/components/app-nav";
import { create } from "zustand";
import { toast } from "sonner";

interface Product { id: string; name: string; description: string; barcode: string; price: number; cost: number; stock: number; minStock: number; wholesalePrice: number; minWholesaleQty: number; icon: string; noStock: boolean; categoryId: string | null; category: { name: string; icon?: string; color?: string } | null; active: boolean; }
interface Category { id: string; name: string; icon?: string; color?: string; _count?: { products: number }; }
interface Settings {
  id: string; storeName: string; storeAddress: string; storePhone: string; storeRif: string;
  bcvRate: number; taxRate: number; currency: string; allowZeroStock: boolean; enableDiscount: boolean; maxDiscountPct: number;
  theme: string;
  ticketFontSize: number; ticketFontFamily: string; ticketHeaderMsg: string; ticketFooterMsg: string;
  ticketShowPhone: boolean; ticketShowSeller: boolean; ticketShowExchange: boolean; ticketShowSlogan: boolean;
  ticketBold: boolean;
  ticketPaperWidth: string;
  ticketMarginLeft: number;
  ticketMarginRight: number;
  ticketUseAgent: boolean;
  ticketAgentUrl: string;
ticketCurrencyMode: string;
}
interface LicenseInfo {
  isValid: boolean; licenseType: "trial" | "basica" | "profesional"; machineId: string;
  licenseKey: string; activatedAt: string; expiresAt: string; daysRemaining: number; isExpired: boolean;
  maxProducts: number; maxDailySales: number; maxUsers: number;
  ownerName: string; ownerEmail: string; ownerPhone: string; ownerRif: string;
  maxActivations: number; activationCount: number;
  previousMachines: string[]; isSameMachine: boolean; machineMismatch: boolean; mismatchReason: string; blockedReason: string;
  features: {
    pos: boolean; products: boolean; categories: boolean; cashClosing: boolean; devolutions: boolean;
    basicReports: boolean; advancedReports: boolean; salesCharts: boolean; autoBackup: boolean;
    exportImport: boolean; noWatermark: boolean; unlimitedProducts: boolean; unlimitedSales: boolean;
    multipleUsers: boolean; inventoryAlerts: boolean; printInvoice: boolean; productDiscount: boolean;
    saleNotes: boolean; priceHistory: boolean; frequentCustomers: boolean; allowZeroStockConfig: boolean;
  };
}

interface AppState { activeTab: string; setActiveTab: (tab: string) => void; }
const useAppStore = create<AppState>((set) => ({ activeTab: "pos", setActiveTab: (tab) => set({ activeTab: tab }) }));

function getStoredUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("myecommerce_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function Home() {
  const { activeTab, setActiveTab } = useAppStore();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>({
    id: "", storeName: "Mi Tienda", storeAddress: "", storePhone: "", storeRif: "",
    bcvRate: 36.5, taxRate: 0, currency: "USD", allowZeroStock: false, enableDiscount: false, maxDiscountPct: 20, theme: "blue",
    ticketFontSize: 8, ticketFontFamily: 'monospace', ticketHeaderMsg: "", ticketFooterMsg: "Gracias por su compra!",
    ticketShowPhone: true, ticketShowSeller: true, ticketShowExchange: true, ticketShowSlogan: false,
    ticketBold: true, ticketPaperWidth: '58mm',
    ticketMarginLeft: 0, ticketMarginRight: 0,
    ticketUseAgent: true, ticketAgentUrl: 'http://localhost:9100',
    ticketCurrencyMode: 'dual',
  });
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [activateKey, setActivateKey] = useState("");
  const [activating, setActivating] = useState(false);

  // Stock alerts
  const [stockAlertCount, setStockAlertCount] = useState(0);
  const [stockZeroCount, setStockZeroCount] = useState(0);
  const [stockBannerDismissed, setStockBannerDismissed] = useState(false);

  // Credito vencido alerts
  const [overdueCreditCount, setOverdueCreditCount] = useState(0);

  // BCV inline editor
  const [editingBcv, setEditingBcv] = useState(false);
  const [inlineBcv, setInlineBcv] = useState("");

  // Apply theme on mount and settings change
  useEffect(() => {
    if (settings.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
  }, [settings.theme]);

  // Auth: load user from localStorage
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setCurrentUser(stored);
    setAuthReady(true);
  }, []);

  const handleLogin = (user: CurrentUser) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("myecommerce_user");
    setCurrentUser(null);
    window.location.reload();
  };

  const handleUserUpdate = (updated: CurrentUser) => {
    setCurrentUser(updated);
    localStorage.setItem("myecommerce_user", JSON.stringify(updated));
  };

  const loadData = useCallback(async () => {
    try {
      const [productsRes, categoriesRes, settingsRes, licenseRes] = await Promise.all([
        fetch("/api/products"), fetch("/api/categories"), fetch("/api/settings"), fetch("/api/license"),
      ]);
      const [productsData, categoriesData, settingsData, licenseData] = await Promise.all([
        productsRes.json(), categoriesRes.json(), settingsRes.json(), licenseRes.json(),
      ]);
      // Solo actualizar si la respuesta es valida (no objeto de error)
      if (Array.isArray(productsData)) setProducts(productsData);
      if (Array.isArray(categoriesData)) setCategories(categoriesData);
      if (settingsData && !settingsData.error && typeof settingsData.bcvRate === 'number') {
        setSettings(settingsData);
      }
      if (licenseData && !licenseData.error) setLicense(licenseData);

      // Inicializar Cliente Final si no existe
      fetch("/api/clients", { method: "PATCH" }).catch(() => {});

// Cargar alertas de stock
      fetch("/api/products/stock-alerts")
        .then(r => r.json())
        .then(data => {
          if (data && !data.error && data.totalAlerts > 0) {
            setStockAlertCount(data.totalAlerts);
            setStockZeroCount(data.zeroStockCount || 0);
            // Toast de notificacion al cargar
            if (data.zeroStockCount > 0) {
              toast.error(`${data.zeroStockCount} producto(s) SIN STOCK`, {
                description: data.zeroStock.slice(0, 3).map((p: any) => p.name).join(', ') + (data.zeroStockCount > 3 ? '...' : ''),
                duration: 6000,
              });
            }
            if (data.lowStockCount > 0) {
              toast.warning(`${data.lowStockCount} producto(s) con stock bajo`, {
                description: "Vaya a Productos para ver el detalle",
                duration: 5000,
              });
            }
          }
        })
        .catch(() => {});

// Cargar alertas de credito vencido
      fetch("/api/credit/overdue")
        .then(r => r.json())
        .then(data => {
          if (data && !data.error && data.count > 0) {
            setOverdueCreditCount(data.count);
            toast.error(`${data.count} credito(s) VENCIDO(S)`, {
              description: `Total pendiente: $${data.totalOverdueUsd.toFixed(2)} — Vaya a Cuentas por Cobrar`,
              duration: 8000,
            });
          }
        })

      const ar = licenseData ? (licenseData.maxActivations - (licenseData.activationCount || 0)) : 0;
      if (licenseData && !licenseData.error && licenseData.machineMismatch && !licenseData.isExpired && licenseData.licenseType !== 'trial' && ar > 0) {
        // Maquina diferente pero hay activaciones restantes → modal amigable
        setTimeout(() => setShowBlockedModal(true), 500);
      } else if (licenseData && !licenseData.error && licenseData.machineMismatch && !licenseData.isExpired && licenseData.licenseType !== 'trial' && ar <= 0) {
        // Sin activaciones restantes → bloqueo real
        setTimeout(() => setShowBlockedModal(true), 500);
      } else if (licenseData && !licenseData.error && (licenseData.isExpired || !licenseData.isValid)) {
        setTimeout(() => setShowExpiredModal(true), 500);
      }
    } catch (error) { console.error("Error loading data:", error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveInlineBcv = async () => {
    const rate = parseFloat(inlineBcv);
    if (isNaN(rate) || rate <= 0) { toast.error("Ingrese una tasa valida mayor a 0"); setEditingBcv(false); return; }
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, bcvRate: rate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data);
      toast.success(`Tasa actualizada: 1$ = ${rate.toFixed(2)} Bs`);
    } catch (error: any) {
      toast.error(error.message || "Error al guardar tasa");
    }
    setEditingBcv(false);
  };

  const activateFromModal = async () => {
    if (!activateKey.trim()) { toast.error("Ingrese la clave de licencia"); return; }
    setActivating(true);
    try {
      const res = await fetch("/api/license", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ licenseKey: activateKey.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setShowActivateModal(false); setShowExpiredModal(false); setShowBlockedModal(false); setActivateKey("");
      loadData();
    } catch (error: any) { toast.error(error.message || "Error al activar licencia"); }
    finally { setActivating(false); }
  };

  // Auto-cerrar sesión por inactividad (1 hora)
  useEffect(() => {
    if (!currentUser) return;
    const INACTIVITY_MS = 60 * 60 * 1000; // 1 hora
    let timeout: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_MS);
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timeout);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [currentUser]);

  // Show loading screen
  if (loading || !authReady) {
    return (<div className="flex items-center justify-center min-h-screen"><div className="text-center space-y-3"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" /><p className="text-muted-foreground">Cargando MyeCommerce...</p></div></div>);
  }
  // Show login screen
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} storeName={settings.storeName} />;
  }

  const isTrial = license?.licenseType === "trial";
  const isExpired = license?.isExpired || false;
  const activationsRemaining = license ? (license.maxActivations - (license.activationCount || 0)) : 0;
  const isMachineBlocked = license?.machineMismatch && !isTrial && activationsRemaining <= 0 && !!license?.blockedReason;
  const isDifferentMachine = license?.machineMismatch && !isTrial && activationsRemaining > 0;
  const showWatermark = isTrial || !license?.features?.noWatermark;
  const canDevolutions = license?.features?.devolutions || false;
  const canCashClosing = license?.features?.cashClosing || false;
  const canFrequentCustomers = license?.features?.frequentCustomers || false;

  const allTabs = [
    { value: "dashboard", label: "Dashboard", icon: "📊", allowed: true, restricted: false, plan: "" },
    { value: "pos", label: "Punto de Venta", icon: "💳", allowed: true, restricted: false, plan: "" },
    { value: "clients", label: "Clientes", icon: "👥", allowed: canFrequentCustomers, restricted: !canFrequentCustomers, plan: "PRO" },
    { value: "products", label: "Productos", icon: "📦", allowed: true, restricted: false, plan: "" },
    { value: "reports", label: "Informes", icon: "📈", allowed: true, restricted: false, plan: "" },
    { value: "devolutions", label: "Devoluciones", icon: "🔄", allowed: canDevolutions, restricted: !canDevolutions, plan: "BASICA+" },
    { value: "cash-closing", label: "Cierre de Caja", icon: "💰", allowed: canCashClosing, restricted: !canCashClosing, plan: "BASICA+" },
    { value: "config", label: "Configuracion", icon: "⚙️", allowed: true, restricted: false, plan: "" },
    { value: "license", label: "Licencia", icon: "🔑", allowed: true, restricted: false, plan: "" },
    { value: "users", label: "Usuarios", icon: "👤", allowed: currentUser?.role === "admin", restricted: false, plan: "" },
    { value: "backup", label: "Respaldo", icon: "💾", allowed: currentUser?.role === "admin", restricted: false, plan: "" },
    { value: "suppliers", label: "Proveedores", icon: "🏪", allowed: true, restricted: false, plan: "" },
    { value: "purchases", label: "Compras", icon: "🛒", allowed: true, restricted: false, plan: "" },
    { value: "credit", label: "Cuentas por Cobrar", icon: "💳", allowed: true, restricted: false, plan: "" },
  ];

  // Filter tabs based on user role and permissions
  const availableTabs = allTabs.filter((tab) => {
    if (currentUser.role === "admin") return tab.allowed;
    // Admin-only tabs (cannot be overridden by permissions)
    if (tab.value === "users") return false;
    if (tab.value === "config") return false;
    if (tab.value === "license") return false;
    // POS always available to any logged-in user
    if (tab.value === "pos") return true;
    if (tab.value === "suppliers") {
      return tab.allowed && !!currentUser.permissions?.suppliers;
    }
    if (tab.value === "purchases") {
      return tab.allowed && !!currentUser.permissions?.purchases;
    }
    if (tab.value === "credit") {
      return tab.allowed && !!currentUser.permissions?.credit;
    }
    // For other tabs, check individual permissions
    const permKey = tab.value === "cash-closing" ? "cash_closing" : tab.value;
    const perm = currentUser.permissions?.[permKey];
    return tab.allowed && !!perm;
  });

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* BANNERS */}
      {isTrial && !isExpired && (
        <div className="bg-yellow-500 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2">
          <span>MODO PRUEBA - {license?.daysRemaining} dias restantes</span>
          <button onClick={() => setShowActivateModal(true)} className="bg-white text-yellow-700 px-3 py-0.5 rounded text-xs font-bold hover:bg-yellow-100 ml-2">ACTIVAR LICENCIA</button>
        </div>
      )}
      {isExpired && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-xs font-bold flex items-center justify-center gap-2">
          <span>LICENCIA EXPIRADA</span>
          <button onClick={() => setShowActivateModal(true)} className="bg-white text-red-700 px-3 py-0.5 rounded text-xs font-bold hover:bg-red-100 ml-2">ACTIVAR</button>
        </div>
      )}
      {isDifferentMachine && !isExpired && (
        <div className="bg-yellow-500 text-white text-center py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2">
          <span>&#9888;&#65039; LICENCIA EN OTRO EQUIPO - Activaciones restantes: {activationsRemaining}</span>
          <button onClick={() => setShowBlockedModal(true)} className="bg-white text-yellow-700 px-3 py-0.5 rounded text-xs font-bold hover:bg-yellow-100 ml-2">ACTIVAR AQUI</button>
        </div>
      )}
      {isMachineBlocked && !isExpired && (
        <div className="bg-red-600 text-white text-center py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2">
          <span>&#128274; LICENCIA BLOQUEADA - Maximo de activaciones alcanzado</span>
          <button onClick={() => setShowBlockedModal(true)} className="bg-white text-red-700 px-3 py-0.5 rounded text-xs font-bold hover:bg-red-100 ml-2">VER DETALLES</button>
        </div>
      )}
      {!isTrial && !isExpired && license?.isValid && !isMachineBlocked && !isDifferentMachine && (
        <div className="bg-green-600 text-white text-center py-0.5 px-4 text-[10px]">
          <span className="font-medium">{license.licenseType.toUpperCase()} | Vence: {new Date(license.expiresAt).toLocaleDateString("es-VE")} | {license.daysRemaining} dias</span>
          {license.ownerName && <span> | {license.ownerName}</span>}
        </div>
      )}

      {/* STOCK ALERTS BANNER */}
      {stockAlertCount > 0 && !stockBannerDismissed && (
        <div className="bg-orange-500 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2">
          <span>&#9888; {stockAlertCount} producto(s) con alerta de stock</span>
          {stockZeroCount > 0 && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">{stockZeroCount} SIN STOCK</span>}
          <button
            onClick={() => { setActiveTab("products"); setStockBannerDismissed(true); }}
            className="bg-white text-orange-700 px-3 py-0.5 rounded text-xs font-bold hover:bg-orange-100 ml-2"
          >
            VER PRODUCTOS
          </button>
          <button
            onClick={() => setStockBannerDismissed(true)}
            className="text-white/70 hover:text-white ml-1 text-base leading-none"
            title="Ocultar"
          >
            &#10005;
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppNav activeTab={activeTab} onTabChange={(v: string) => {
              const tab = availableTabs.find(t => t.value === v);
              if (!tab) return;
              if (!tab.allowed) { toast.error(`"${tab.label}" requiere plan ${tab.plan}. Actualice su licencia.`); return; }
              setActiveTab(v);
            }} tabs={availableTabs.map(t => ({ value: t.value, label: t.label, icon: t.icon }))} stockAlertCount={stockAlertCount} />
            <div>
              <h1 className="text-xl font-bold text-primary">
                {settings.storeName}
                {showWatermark && <span className="text-xs font-normal text-yellow-600 ml-2">(TRIAL)</span>}
              </h1>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>v2.9.16 | 1$ =</span>
                {editingBcv ? (
                  <input type="number" min="0" step="0.01" value={inlineBcv}
                    onChange={(e) => setInlineBcv(e.target.value)}
                    onBlur={saveInlineBcv}
                    onKeyDown={(e: any) => { if (e.key === "Enter") saveInlineBcv(); if (e.key === "Escape") setEditingBcv(false); }}
                    autoFocus
                    className="w-20 bg-transparent border-b border-primary text-primary font-bold text-xs px-1 py-0 focus:outline-none" />
                ) : (
                  <button onClick={() => { setInlineBcv((settings.bcvRate ?? 36.5).toFixed(2)); setEditingBcv(true); }}
                    className="font-bold text-primary hover:underline cursor-pointer">
                    {(settings.bcvRate ?? 36.5).toFixed(2)}
                  </button>
                )}
                <span>Bs</span>
                {!editingBcv && <span className="text-[9px] text-muted-foreground/60">(click para cambiar)</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground">
              <p>{new Date().toLocaleDateString("es-VE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              <p>{new Date().toLocaleTimeString("es-VE")}</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-primary/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold">
                  {(currentUser.fullName || currentUser.username).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
              )}
              <Badge variant={currentUser.role === "admin" ? "default" : "secondary"}>
                {currentUser.role === "admin" ? "Admin" : currentUser.role === "vendedor" ? "Vendedor" : "Cajero"}
              </Badge>
              <span className="text-sm font-medium max-w-[120px] truncate hidden sm:inline-block">
                {currentUser.fullName || currentUser.username}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                title="Cerrar sesion"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* NAV - Barra de tabs: visible solo en escritorio como referencia rapida */}
      <div className="border-b bg-card hidden md:block">
        <div className="container mx-auto px-2 py-2">
          <div className="overflow-x-visible">
            <TabsList className="w-full flex-wrap">
              {availableTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} activeTab={activeTab}
                  setActiveTab={(v: string) => {
                    if (!tab.allowed) { toast.error(`"${tab.label}" requiere plan ${tab.plan}. Actualice su licencia.`); return; }
                    setActiveTab(v);
                  }}>
                  {tab.label}
                  {tab.restricted && <Badge variant="destructive" className="ml-1 text-[8px] px-1 py-0">{tab.plan}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1 container mx-auto px-4 py-4">
        <TabsContent value="dashboard" activeTab={activeTab}>
          <ErrorBoundary name="Dashboard">
            <DashboardTab bcvRate={settings.bcvRate ?? 36.5} currency={settings.currency} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="pos" activeTab={activeTab}>
          <ErrorBoundary name="Punto de Venta">
            <PosTab products={products} bcvRate={settings.bcvRate ?? 36.5} taxRate={settings.taxRate ?? 0}
              storeName={settings.storeName} storeAddress={settings.storeAddress} storeRif={settings.storeRif}
              storePhone={settings.storePhone} currency={settings.currency} allowZeroStock={settings.allowZeroStock}
              enableDiscount={settings.enableDiscount} maxDiscountPct={settings.maxDiscountPct ?? 20}
              canSaleNotes={license?.features?.saleNotes || false} canFrequentCustomers={canFrequentCustomers}
              sellerName={currentUser.fullName || currentUser.username}
              sellerRole={currentUser.role}
              ticketFontSize={settings.ticketFontSize || 8}
              ticketFontFamily={settings.ticketFontFamily || 'monospace'}
              ticketHeaderMsg={settings.ticketHeaderMsg || ""}
              ticketFooterMsg={settings.ticketFooterMsg || "Gracias por su compra!"}
              ticketShowPhone={settings.ticketShowPhone !== false}
              ticketShowSeller={settings.ticketShowSeller !== false}
              ticketShowExchange={settings.ticketShowExchange !== false}
              ticketShowSlogan={settings.ticketShowSlogan === true}
              ticketBold={settings.ticketBold !== false}
              ticketPaperWidth={settings.ticketPaperWidth || '58mm'}
              ticketMarginLeft={settings.ticketMarginLeft ?? 0}
              ticketMarginRight={settings.ticketMarginRight ?? 0}
              ticketUseAgent={settings.ticketUseAgent !== false}
              ticketAgentUrl={settings.ticketAgentUrl || 'http://localhost:9100'}
              ticketCurrencyMode={settings.ticketCurrencyMode || 'dual'}
              onSaleComplete={loadData}
            />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="clients" activeTab={activeTab}>
          <ErrorBoundary name="Clientes">
            {canFrequentCustomers ? (
              <ClientsTab bcvRate={settings.bcvRate ?? 36.5} currency={settings.currency}
                storeRif={settings.storeRif} storeName={settings.storeName} storeAddress={settings.storeAddress} />
            ) : (
              <UpgradePrompt feature="Modulo de Clientes" plan="PROFESIONAL"
                desc="Gestione clientes, facture con datos fiscales, registre personas naturales y empresas con cedula/RIF." />
            )}
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="products" activeTab={activeTab}>
          <ErrorBoundary name="Productos">
            <ProductsTab products={products} categories={categories} bcvRate={settings.bcvRate ?? 36.5}
              currency={settings.currency} onRefresh={loadData} maxProducts={license?.maxProducts || 30} licenseType={license?.licenseType || "trial"} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="devolutions" activeTab={activeTab}>
          <ErrorBoundary name="Devoluciones">
            {canDevolutions ? <DevolutionsTab bcvRate={settings.bcvRate ?? 36.5} currency={settings.currency} /> : <UpgradePrompt feature="Devoluciones" plan="BASICA+" />}
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="cash-closing" activeTab={activeTab}>
          <ErrorBoundary name="Cierre de Caja">
            {canCashClosing ? <CashClosingTab bcvRate={settings.bcvRate ?? 36.5} currency={settings.currency} /> : <UpgradePrompt feature="Cierre de Caja" plan="BASICA+" />}
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="reports" activeTab={activeTab}>
          <ErrorBoundary name="Informes">
            <ReportsTab bcvRate={settings.bcvRate ?? 36.5} currency={settings.currency} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="config" activeTab={activeTab}>
          <ErrorBoundary name="Configuracion">
            <ConfigTab settings={settings} onSettingsChange={(s) => { setSettings(s); loadData(); }}
              licenseFeatures={{ autoBackup: license?.features?.autoBackup || false, exportImport: license?.features?.exportImport || false, allowZeroStockConfig: license?.features?.allowZeroStockConfig || false, productDiscount: license?.features?.productDiscount || false }} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="license" activeTab={activeTab}>
          <ErrorBoundary name="Licencia">
            <LicenseTab license={license} onLicenseChange={loadData} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="users" activeTab={activeTab}>
          <ErrorBoundary name="Usuarios">
            <UsersTab currentUser={currentUser} onUserUpdate={handleUserUpdate} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="backup" activeTab={activeTab}>
          <ErrorBoundary name="Respaldos">
            <BackupTab />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="suppliers" activeTab={activeTab}>
          <ErrorBoundary name="Proveedores">
            <SuppliersTab />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="purchases" activeTab={activeTab}>
          <ErrorBoundary name="Compras">
            <PurchasesTab bcvRate={settings.bcvRate ?? 36.5} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="credit" activeTab={activeTab}>
          <ErrorBoundary name="CxC">
            <CreditTab bcvRate={settings.bcvRate ?? 36.5} currency={settings.currency}
              sellerName={currentUser.fullName || currentUser.username} />
          </ErrorBoundary>
        </TabsContent>
      </main>

      {showWatermark && <div className="fixed bottom-12 right-4 text-yellow-500/30 text-6xl font-bold pointer-events-none select-none rotate-[-15deg] z-50">TRIAL</div>}

      <footer className="border-t py-2 text-center text-xs text-muted-foreground">
        <p>MyeCommerce POS v2.9.16 - Sistema Punto de Venta Venezuela | Doble Moneda $/Bs{showWatermark && " | Version de Prueba"}</p>
      </footer>

      {/* MODALES */}

      <Dialog open={showExpiredModal} onOpenChange={setShowExpiredModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-center text-destructive text-xl">Licencia Expirada</DialogTitle></DialogHeader>
          <div className="text-center space-y-4">
            <p className="text-sm">Su licencia ha expirado. Active una nueva clave para continuar.</p>
            <div><Label>Clave de Licencia</Label><Input value={activateKey} onChange={(e: any) => setActivateKey(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" className="font-mono text-center tracking-widest" /></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setShowExpiredModal(false)}>Continuar (limitado)</Button><Button className="flex-1" onClick={activateFromModal} disabled={activating || !activateKey.trim()}>{activating ? "Activando..." : "Activar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showActivateModal} onOpenChange={setShowActivateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Activar Licencia</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Ingrese su clave de licencia.</p>
            <div><Label>Clave de Licencia</Label><Input value={activateKey} onChange={(e: any) => setActivateKey(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" className="font-mono text-center text-lg tracking-widest" onKeyDown={(e: any) => e.key === "Enter" && activateFromModal()} /></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setShowActivateModal(false)}>Cancelar</Button><Button className="flex-1" onClick={activateFromModal} disabled={activating || !activateKey.trim()}>{activating ? "Activando..." : "Activar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showBlockedModal} onOpenChange={setShowBlockedModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-center text-lg">{isMachineBlocked ? <span className="text-red-700">&#128274; Licencia Bloqueada</span> : <span className="text-yellow-700">&#9888;&#65039; Equipo No Reconocido</span>}</DialogTitle></DialogHeader>
          <div className="text-center space-y-4">
            {isMachineBlocked ? (
              <>
                <p className="text-sm text-red-700">Esta licencia ha alcanzado el maximo de activaciones permitidas ({license?.maxActivations}).</p>
                <p className="text-sm text-muted-foreground">Contacte al administrador del sistema para solicitar un restablecimiento.</p>
                {license && <div className="p-3 bg-muted rounded text-xs space-y-1"><p className="text-muted-foreground">Machine ID de este equipo:</p><p className="font-mono font-bold">{license.machineId}</p></div>}
                <Button variant="outline" className="w-full" onClick={() => setShowBlockedModal(false)}>Cerrar</Button>
              </>
            ) : (
              <>
                <p className="text-sm">Esta licencia fue activada en otra computadora. Si cambio de equipo o formateo, puede reactivarla.</p>
                {license && <div className="p-3 bg-muted rounded text-xs space-y-1"><p className="text-muted-foreground">Machine ID de este equipo:</p><p className="font-mono font-bold">{license.machineId}</p><p className="text-muted-foreground mt-1">Activaciones restantes: <strong>{activationsRemaining}</strong> de {license.maxActivations}</p></div>}
                <div><Label>Clave de Licencia</Label><Input value={activateKey} onChange={(e: any) => setActivateKey(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" className="font-mono text-center tracking-widest" onKeyDown={(e: any) => e.key === "Enter" && activateFromModal()} /></div>
                <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setShowBlockedModal(false)}>Cancelar</Button><Button className="flex-1" onClick={activateFromModal} disabled={activating || !activateKey.trim()}>{activating ? "Activando..." : "Activar"}</Button></div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UpgradePrompt({ feature, plan, desc }: { feature: string; plan: string; desc?: string }) {
  const [showActivate, setShowActivate] = useState(false);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const activate = async () => {
    if (!key.trim()) return; setLoading(true);
    try { const res = await fetch("/api/license", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ licenseKey: key.trim() }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); toast.success(data.message); setShowActivate(false); setTimeout(() => window.location.reload(), 1000); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Card className="max-w-md w-full border-yellow-300">
        <CardContent className="p-6 text-center space-y-4">
          <div className="text-4xl">&#128274;</div>
          <h3 className="text-lg font-semibold">Funcion Bloqueada</h3>
          <p className="text-sm text-muted-foreground"><strong>{feature}</strong> no disponible en su plan. Actualice a <strong>{plan}</strong>.</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
          <div className="space-y-2">
            <Button className="w-full" onClick={() => setShowActivate(true)}>Activar Licencia</Button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={showActivate} onOpenChange={setShowActivate}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Activar Licencia</DialogTitle></DialogHeader>
          <div className="space-y-3"><Input value={key} onChange={(e: any) => setKey(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" className="font-mono text-center tracking-widest" /><Button className="w-full" onClick={activate} disabled={loading || !key.trim()}>{loading ? "Activando..." : "Activar"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
