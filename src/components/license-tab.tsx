"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FEATURE_LABELS } from "@/lib/license";
import { authFetch } from "@/lib/auth-fetch";

interface LicenseInfo {
  isValid: boolean;
  licenseType: "trial" | "basica" | "profesional";
  machineId: string;
  licenseKey: string;
  activatedAt: string;
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
  maxProducts: number;
  maxDailySales: number;
  maxUsers: number;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerRif: string;
  features: any;
  maxActivations: number;
  activationCount: number;
  previousMachines: string[];
  isSameMachine: boolean;
  machineMismatch: boolean;
  mismatchReason: string;
  blockedReason: string;
}

interface LicenseTabProps {
  license: LicenseInfo | null;
  onLicenseChange: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  trial: "TRIAL",
  basica: "BASICA",
  profesional: "PROFESIONAL",
};

const TYPE_COLORS: Record<string, string> = {
  trial: "warning",
  basica: "default",
  profesional: "success",
};

// Features ordenadas por importancia para mostrar
const FEATURE_DISPLAY_ORDER = [
  "pos", "products", "categories", "cashClosing", "devolutions",
  "basicReports", "advancedReports", "salesCharts", "autoBackup",
  "exportImport", "noWatermark", "unlimitedProducts", "unlimitedSales",
  "multipleUsers", "inventoryAlerts", "printInvoice", "productDiscount",
  "saleNotes", "priceHistory", "frequentCustomers", "allowZeroStockConfig",
];

// Datos de la tabla comparativa
const COMPARISON_TABLE = [
  { feature: "Duracion", trial: "15 dias", basica: "365 dias", profesional: "365 dias" },
  { feature: "Productos max.", trial: "30", basica: "300", profesional: "Ilimitados" },
  { feature: "Ventas/dia", trial: "15", basica: "Ilimitadas", profesional: "Ilimitadas" },
  { feature: "Cajeros (Usuarios)", trial: "1", basica: "1", profesional: "5" },
  { feature: "Punto de Venta", trial: "Si", basica: "Si", profesional: "Si" },
  { feature: "Gestion Productos", trial: "Si", basica: "Si", profesional: "Si" },
  { feature: "Categorias", trial: "Si", basica: "Si", profesional: "Si" },
  { feature: "Cierre de Caja", trial: "No", basica: "Si", profesional: "Si" },
  { feature: "Devoluciones", trial: "No", basica: "Si", profesional: "Si" },
  { feature: "Reportes Basicos", trial: "Si", basica: "Si", profesional: "Si" },
  { feature: "Reportes Avanzados", trial: "No", basica: "No", profesional: "Si" },
  { feature: "Graficos de Ventas", trial: "No", basica: "No", profesional: "Si" },
  { feature: "Respaldo Automatico", trial: "No", basica: "Si", profesional: "Si" },
  { feature: "Exportar / Importar", trial: "No", basica: "Si", profesional: "Si" },
  { feature: "Impresion Factura", trial: "No", basica: "Si", profesional: "Si" },
  { feature: "Descuentos", trial: "No", basica: "Si", profesional: "Si" },
  { feature: "Venta con Stock 0", trial: "No", basica: "Si", profesional: "Si" },
  { feature: "Notas en Ventas", trial: "No", basica: "No", profesional: "Si" },
  { feature: "Historial Precios", trial: "No", basica: "No", profesional: "Si" },
  { feature: "Clientes Frecuentes", trial: "No", basica: "No", profesional: "Si" },
  { feature: "Alertas Inventario", trial: "No", basica: "No", profesional: "Si" },
  { feature: "Multi-Cajeros", trial: "No", basica: "No", profesional: "Si" },
  { feature: "Marca de Agua", trial: "Si", basica: "No", profesional: "No" },
  { feature: "Activaciones", trial: "1", basica: "2", profesional: "3" },
];

export default function LicenseTab({ license, onLicenseChange }: LicenseTabProps) {
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerRif, setOwnerRif] = useState("");
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullComparison, setShowFullComparison] = useState(false);

  const activateLicense = async () => {
    if (!licenseKey.trim()) {
      toast.error("Ingrese la clave de licencia");
      return;
    }
    setActivating(true);
    try {
      const res = await authFetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          ownerName: ownerName.trim(),
          ownerEmail: ownerEmail.trim(),
          ownerPhone: ownerPhone.trim(),
          ownerRif: ownerRif.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      toast.success(data.message);
      setShowActivateDialog(false);
      setLicenseKey("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPhone("");
      setOwnerRif("");
      onLicenseChange();
    } catch (error: any) {
      toast.error(error.message || "Error al activar licencia");
    } finally {
      setActivating(false);
    }
  };

  const copyMachineId = () => {
    if (license?.machineId) {
      navigator.clipboard.writeText(license.machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Machine ID copiado al portapapeles");
    }
  };

  if (!license) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando informacion de licencia...</p>
      </div>
    );
  }

  const isTrial = license.licenseType === "trial";
  const isExpired = license.isExpired;
  // Solo está realmente bloqueada si hay un blockedReason O si no quedan activaciones
  const activationsRemaining = license.maxActivations - license.activationCount;
  const isBlocked = !!license.blockedReason || (license.machineMismatch && activationsRemaining <= 0);
  const isDifferentMachine = license.machineMismatch && activationsRemaining > 0;

  // Filtrar features disponibles del plan actual (solo los true)
  const enabledFeatures = FEATURE_DISPLAY_ORDER.filter(
    (f) => license.features[f] === true
  );

  return (
    <div className="space-y-6">
      {/* ====== Maquina diferente pero puede reactivar ====== */}
      {isDifferentMachine && !isTrial && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">&#9888;&#65039;</span>
              <div className="flex-1">
                <h3 className="font-bold text-yellow-800 text-lg">LICENCIA VINCULADA A OTRO EQUIPO</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Esta licencia fue activada en otra computadora. Si cambio de equipo o formateo,
                  puede reactivarla facilmente haciendo clic abajo.
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Quedan <strong>{activationsRemaining}</strong> activacion(es) disponible(s) de {license.maxActivations}.
                </p>
                <div className="mt-3">
                  <p className="text-xs text-yellow-600 font-medium">
                    Machine ID de este equipo: {license.machineId}
                  </p>
                  <Button size="sm" className="mt-2" onClick={() => setShowActivateDialog(true)}>
                    Activar en este equipo
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ====== BLOQUEADO - Sin activaciones restantes ====== */}
      {isBlocked && !isTrial && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">&#128274;</span>
              <div className="flex-1">
                <h3 className="font-bold text-red-800 text-lg">LICENCIA BLOQUEADA</h3>
                <p className="text-sm text-red-700 mt-1">
                  {license.mismatchReason || "Esta licencia ha alcanzado el maximo de activaciones permitidas."}
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Contacte al administrador del sistema para solicitar una nueva licencia o un restablecimiento de activaciones.
                </p>
                <div className="mt-3">
                  <p className="text-xs text-red-600 font-medium">
                    Machine ID de este equipo: {license.machineId}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ====== Estado actual ====== */}
      <Card className={isTrial ? "border-yellow-300 bg-yellow-50" : isExpired ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-3">
            Estado de Licencia
            <Badge variant={(TYPE_COLORS[license.licenseType] as any) || "default"}>
              {TYPE_LABELS[license.licenseType]}
            </Badge>
            {!license.isValid && <Badge variant="destructive">INACTIVA</Badge>}
            {license.isValid && !isTrial && <Badge variant="success">ACTIVA</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="font-bold">{TYPE_LABELS[license.licenseType]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Activacion</p>
              <p className="font-medium text-sm">
                {new Date(license.activatedAt).toLocaleDateString("es-VE")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiracion</p>
              <p className={`font-medium text-sm ${isExpired ? "text-destructive" : ""}`}>
                {new Date(license.expiresAt).toLocaleDateString("es-VE")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dias restantes</p>
              <p className={`font-bold text-xl ${license.daysRemaining <= 7 ? "text-destructive" : "text-green-600"}`}>
                {license.daysRemaining}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cajeros</p>
              <p className="font-bold text-xl">{license.maxUsers}</p>
            </div>
          </div>

          {license.ownerName && (
            <div className="text-sm">
              <span className="text-muted-foreground">Licenciatario: </span>
              <span className="font-medium">{license.ownerName}</span>
              {license.ownerRif && <span className="text-muted-foreground ml-2">RIF: {license.ownerRif}</span>}
              {license.ownerEmail && <span className="text-muted-foreground ml-2">({license.ownerEmail})</span>}
              {license.ownerPhone && <span className="text-muted-foreground ml-2">{license.ownerPhone}</span>}
            </div>
          )}

          {license.licenseKey && license.licenseKey !== "TRIAL-AUTO" && (
            <div className="text-sm">
              <span className="text-muted-foreground">Clave: </span>
              <code className="bg-muted px-2 py-1 rounded font-mono text-xs">{license.licenseKey}</code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== Limites del plan ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Limites de su Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded border text-center">
              <p className="text-2xl font-bold">{license.maxProducts >= 99999 ? "INF" : license.maxProducts}</p>
              <p className="text-xs text-muted-foreground">Productos maximos</p>
            </div>
            <div className="p-3 rounded border text-center">
              <p className="text-2xl font-bold">{license.maxDailySales >= 99999 ? "INF" : license.maxDailySales}</p>
              <p className="text-xs text-muted-foreground">Ventas por dia</p>
            </div>
            <div className="p-3 rounded border text-center">
              <p className="text-2xl font-bold">{license.maxUsers}</p>
              <p className="text-xs text-muted-foreground">Cajeros</p>
            </div>
            <div className="p-3 rounded border text-center">
              <p className={`text-2xl font-bold ${activationsRemaining <= 0 ? "text-destructive" : "text-green-600"}`}>
                {activationsRemaining}
              </p>
              <p className="text-xs text-muted-foreground">Activaciones restantes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== Maquina y Activaciones ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span>&#128187;</span> Equipo y Activaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Machine ID de este equipo</p>
                <p className="font-mono font-bold text-sm mt-1">{license.machineId}</p>
              </div>
              <Button variant="outline" size="sm" onClick={copyMachineId}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Este ID identifica de forma unica esta computadora. Proporcione este ID al administrador para generar su licencia.
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded border text-center">
              <p className="text-2xl font-bold">{license.activationCount}</p>
              <p className="text-[10px] text-muted-foreground">Activaciones usadas</p>
            </div>
            <div className="p-3 rounded border text-center">
              <p className={`text-2xl font-bold ${activationsRemaining <= 0 ? "text-destructive" : "text-green-600"}`}>
                {activationsRemaining}
              </p>
              <p className="text-[10px] text-muted-foreground">Activaciones restantes</p>
            </div>
            <div className="p-3 rounded border text-center">
              <p className="text-2xl font-bold">{license.maxActivations}</p>
              <p className="text-[10px] text-muted-foreground">Maximo permitido</p>
            </div>
          </div>

          <div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  activationsRemaining <= 0
                    ? "bg-red-500"
                    : activationsRemaining === 1
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(100, (license.activationCount / license.maxActivations) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {activationsRemaining <= 0
                ? "No quedan activaciones disponibles. Contacte al administrador."
                : `Puede activar en ${activationsRemaining} equipo(s) mas.`}
            </p>
          </div>

          {license.previousMachines && license.previousMachines.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Historial de equipos:</p>
                <div className="space-y-1">
                  {license.previousMachines.map((m: any, i: number) => {
                    const machineId = typeof m === 'string' ? m : m.machineId;
                    const lastSeen = typeof m === 'string' ? '' : m.lastSeen;
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs">
                        <code className="font-mono">{machineId}</code>
                        {lastSeen && (
                          <span className="text-muted-foreground">
                            {new Date(lastSeen).toLocaleDateString("es-VE")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ====== Funciones disponibles ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Funciones de su Plan ({TYPE_LABELS[license.licenseType]})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {FEATURE_DISPLAY_ORDER.map((key) => {
              const enabled = license.features[key] === true;
              return (
                <div key={key} className="flex justify-between items-center py-1">
                  <span className="text-sm">{FEATURE_LABELS[key] || key}</span>
                  <Badge variant={enabled ? "success" : "destructive"}>
                    {enabled ? "Disponible" : "No disponible"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ====== Trial info ====== */}
      {isTrial && !isExpired && (
        <Card className="border-yellow-400">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">&#9888;</span>
              <div className="flex-1">
                <p className="font-semibold text-yellow-800">Version de PRUEBA - {license.daysRemaining} dias restantes</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Prueba MyeCommerce POS con funciones basicas. Al activar una licencia BASICA o PROFESIONAL
                  desbloqueara todas las funciones y el sistema quedara vinculado permanentemente a este equipo.
                </p>
                <div className="mt-2 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                  <p className="font-semibold">Limites del Trial:</p>
                  <ul className="list-disc ml-4 mt-1 space-y-0.5">
                    <li>Maximo 30 productos y 15 ventas por dia</li>
                    <li>Sin cierre de caja, devoluciones ni respaldos</li>
                    <li>Sin impresion de factura ni descuentos</li>
                    <li>No permite vender con stock en 0</li>
                  </ul>
                </div>
                <Button size="sm" className="mt-3" onClick={() => setShowActivateDialog(true)}>
                  Activar Licencia
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ====== Expirada ====== */}
      {isExpired && (
        <Card className="border-red-400">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">&#10060;</span>
              <div className="flex-1">
                <p className="font-semibold text-red-800">LICENCIA EXPIRADA</p>
                <p className="text-sm text-red-700 mt-1">
                  Su licencia ha expirado. Active una nueva clave para continuar utilizando MyeCommerce POS.
                  Sus datos se conservan de forma segura.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setShowActivateDialog(true)}>
                  Activar Nueva Licencia
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ====== Comparativa de planes ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Comparativa de Planes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Funcion</th>
                  <th className="text-center p-2 text-yellow-700 font-bold">TRIAL</th>
                  <th className="text-center p-2 text-blue-700 font-bold">BASICA</th>
                  <th className="text-center p-2 text-green-700 font-bold">PROFESIONAL</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_TABLE.map((row) => (
                  <tr key={row.feature} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-medium">{row.feature}</td>
                    <td className={`text-center p-2 ${row.trial === "Si" ? "text-green-600" : row.trial === "No" ? "text-red-500" : row.trial === "Ilimitados" ? "text-green-600 font-bold" : ""}`}>{row.trial}</td>
                    <td className={`text-center p-2 ${row.basica === "Si" ? "text-green-600" : row.basica === "No" ? "text-red-500" : row.basica === "Ilimitadas" || row.basica === "Ilimitados" ? "text-green-600 font-bold" : ""}`}>{row.basica}</td>
                    <td className={`text-center p-2 ${row.profesional === "Si" ? "text-green-600" : row.profesional === "No" ? "text-red-500" : row.profesional === "Ilimitadas" || row.profesional === "Ilimitados" ? "text-green-600 font-bold" : ""}`}>{row.profesional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="p-3 rounded border border-yellow-300 bg-yellow-50 text-center">
              <p className="font-bold text-yellow-800 text-sm">TRIAL</p>
              <p className="text-2xl font-bold text-yellow-700">Gratis</p>
              <p className="text-[10px] text-muted-foreground">15 dias</p>
            </div>
            <div className="p-3 rounded border border-blue-300 bg-blue-50 text-center">
              <p className="font-bold text-blue-800 text-sm">BASICA</p>
              <p className="text-2xl font-bold text-blue-700">$110</p>
              <p className="text-[10px] text-muted-foreground">365 dias - Todo lo esencial</p>
            </div>
            <div
              className="p-3 rounded-lg border-2 border-amber-400 text-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 40%, #fde68a 100%)",
                boxShadow: "0 0 18px rgba(245,158,11,0.35), inset 0 0 12px rgba(245,158,11,0.08)",
                animation: "promoPulse 2.5s ease-in-out infinite",
              }}
            >
              {/* Badge ribbon */}
              <span
                className="absolute -top-1 -right-6 text-white text-[9px] px-3 py-0.5 font-extrabold uppercase tracking-wider rotate-45 shadow"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  borderRadius: "0 0 6px 6px",
                }}
              >
                Oferta
              </span>
              <p className="font-bold text-amber-800 text-sm mt-1">PROFESIONAL</p>
              {/* Precio anterior tachado */}
              <p
                className="text-sm line-through text-gray-400 mt-1"
                style={{ textDecorationColor: "#ef4444", textDecorationThickness: "2px" }}
              >
                $280
              </p>
              {/* Precio promo grande */}
              <p
                className="text-3xl font-extrabold mt-0.5"
                style={{
                  color: "#b45309",
                  textShadow: "0 1px 2px rgba(0,0,0,0.08)",
                }}
              >
                $180
              </p>
              {/* CTA llamativo */}
              <p
                className="text-xs font-bold mt-1"
                style={{
                  color: "#ef4444",
                  animation: "ctaPulse 2s ease-in-out infinite",
                }}
              >
                Ahorra $100 hoy
              </p>
              <p className="text-[9px] text-amber-600 mt-0.5">
                365 dias - Sin limites
              </p>
              {/* Estilos inline de animación */}
              <style>{`
                @keyframes promoPulse {
                  0%, 100% { box-shadow: 0 0 18px rgba(245,158,11,0.35), inset 0 0 12px rgba(245,158,11,0.08); transform: scale(1); }
                  50% { box-shadow: 0 0 28px rgba(245,158,11,0.55), inset 0 0 20px rgba(245,158,11,0.12); transform: scale(1.015); }
                }
                @keyframes ctaPulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.65; }
                }
              `}</style>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Boton de activacion */}
      <div className="text-center">
        <Button onClick={() => setShowActivateDialog(true)} variant="outline">
          Activar / Renovar Licencia
        </Button>
      </div>

      {/* ====== Dialogo de Activacion ====== */}
      <Dialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar Licencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isBlocked && (
              <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
                <p className="font-semibold">Nota: Activacion en nuevo equipo</p>
                <p>
                  Quedan <strong>{activationsRemaining}</strong> activacion(es) de {license.maxActivations} disponibles.
                  Al activar, esta licencia quedara vinculada a este equipo.
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Ingrese su clave de licencia proporcionada por el administrador del sistema.
            </p>

            <div>
              <Label>Clave de Licencia *</Label>
              <Input
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                className="font-mono text-center text-lg tracking-widest"
              />
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground">Datos del propietario (opcional)</p>

            <div>
              <Label>Nombre / Razon Social</Label>
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nombre del negocio" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RIF / CI</Label>
                <Input value={ownerRif} onChange={(e) => setOwnerRif(e.target.value)} placeholder="J-00000000-0" />
              </div>
              <div>
                <Label>Telefono</Label>
                <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+58 412-1234567" />
              </div>
            </div>

            <div>
              <Label>Correo</Label>
              <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowActivateDialog(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={activateLicense} disabled={activating || !licenseKey.trim()}>
                {activating ? "Activando..." : "Activar Licencia"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
