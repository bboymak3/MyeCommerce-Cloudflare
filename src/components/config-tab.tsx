"use client";

import { useState, useEffect } from "react";
import { getPreset, calcMaxChars } from "@/lib/ticket-printer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

interface Settings {
  id: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeRif: string;
  bcvRate: number;
  taxRate: number;
  currency: string;
  allowZeroStock: boolean;
  enableDiscount: boolean;
  maxDiscountPct: number;
  theme: string;
  ticketFontSize: number;
  ticketFontFamily: string;
  ticketHeaderMsg: string;
  ticketFooterMsg: string;
  ticketShowPhone: boolean;
  ticketShowSeller: boolean;
  ticketShowExchange: boolean;
  ticketCurrencyMode: string;
  ticketShowSlogan: boolean;
  ticketBold: boolean;
  ticketPaperWidth: string;
  ticketMarginLeft: number;
  ticketMarginRight: number;
  ticketUseAgent: boolean;
  ticketAgentUrl: string;
  ticketShowCashReceived: boolean;
  ticketShowLogo: boolean;
  storeLogo: string;
  businessType: string;
  taxMode: string;
}

interface BackupStatus {
  status: string;
  backups: string[];
  total: number;
}

interface ConfigTabProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  licenseFeatures?: {
    autoBackup: boolean;
    exportImport: boolean;
    allowZeroStockConfig: boolean;
    productDiscount: boolean;
  };
}

// ─── Version Checker (mejorado con rollback + todas las versiones) ───
interface VersionEntry {
  version: string;
  name: string;
  notes: string;
  date: string;
  dateRelative: string;
  downloadUrl: string;
  prerelease: boolean;
  isNewer: boolean;
  isOlder: boolean;
  isCurrent: boolean;
}

interface VersionCheckResult {
  status: 'ok' | 'no_internet' | 'repo_not_found' | 'no_releases' | 'error';
  localVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  totalVersions: number;
  versions: VersionEntry[];
  githubRepo: string;
  releasesUrl: string;
  error?: string;
}

function VersionChecker() {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ step: string; message: string; percent: number; backupDir?: string } | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionCheckResult | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const checkVersion = async () => {
    setChecking(true);
    setUpdateProgress(null);
    try {
      const res = await authFetch('/api/check-version');
      const data = await res.json();
      setVersionInfo(data);
      if (data.status !== 'ok') {
        const msgs: Record<string, string> = {
          no_internet: 'No se pudo conectar a GitHub. Verifique su conexion a internet.',
          repo_not_found: 'Repositorio de GitHub no encontrado. Contacte soporte.',
          no_releases: 'No hay releases publicados en GitHub todavia.',
          error: data.error || 'Error desconocido al verificar version.',
        };
        toast.error(msgs[data.status] || 'Error al verificar version');
      }
    } catch {
      toast.error('No se pudo verificar la version');
    } finally {
      setChecking(false);
    }
  };

  // ── Instalar cualquier version (upgrade o rollback) ──
  const installVersion = async (ver: VersionEntry) => {
    const isRollback = ver.isOlder;
    const confirmed = window.confirm(
      isRollback
        ? `RESTAURAR a v${ver.version}?\n\n` +
          `Esto instalara una version ANTERIOR a la actual.\n` +
          `Se creara un respaldo automatico de su version actual antes de continuar.\n` +
          `Despues de la restauracion debera reiniciar el sistema.`
        : `Actualizar a v${ver.version}?\n\n` +
          `Se creara un respaldo automatico antes de actualizar.\n` +
          `Despues de la actualizacion debera reiniciar el sistema.`
    );
    if (!confirmed) return;

    setUpdating(true);
    setUpdateProgress({ step: 'start', message: 'Iniciando...', percent: 0 });

    try {
      const res = await authFetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: ver.version, downloadUrl: ver.downloadUrl }),
      });

      if (!res.ok) throw new Error('Error del servidor');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            const text = decoder.decode(value);
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  setUpdateProgress(data);
                  if (data.step === 'complete') {
                    toast.success(isRollback
                      ? `Restaurado a v${ver.version}! Reinicie el sistema.`
                      : `Actualizado a v${ver.version}! Reinicie el sistema.`
                    );
                  } else if (data.step === 'error') {
                    toast.error(data.message);
                  }
                } catch {}
              }
            }
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error en la actualizacion');
      setUpdateProgress({ step: 'error', message: err?.message || 'Error desconocido', percent: 0 });
    } finally {
      setUpdating(false);
    }
  };

  // ── Renderizar mensaje de estado ──
  const renderStatus = () => {
    if (!versionInfo) return null;
    if (versionInfo.status === 'ok') return null;

    const statusConfig: Record<string, { icon: string; title: string; desc: string; color: string }> = {
      no_internet: {
        icon: 'No hay conexion a Internet',
        title: 'No se pudo conectar a GitHub',
        desc: 'Verifique su conexion a internet e intente de nuevo. Puede usar la actualizacion local (manual) mientras tanto.',
        color: 'bg-orange-50 border-orange-200 text-orange-800',
      },
      repo_not_found: {
        icon: 'Repositorio no encontrado',
        title: 'Repositorio de GitHub no disponible',
        desc: `El repositorio configurado (${versionInfo.githubRepo}) no fue encontrado. Puede que sea privado o la URL este incorrecta. Contacte soporte tecnico.`,
        color: 'bg-red-50 border-red-200 text-red-800',
      },
      no_releases: {
        icon: 'Sin releases',
        title: 'No hay versiones publicadas',
        desc: 'Aun no se han publicado releases de versiones en GitHub. Contacte soporte tecnico para obtener la actualizacion manualmente.',
        color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      },
    };

    const cfg = statusConfig[versionInfo.status];
    if (!cfg) return null;

    return (
      <div className={`p-3 rounded-lg border text-sm ${cfg.color}`}>
        <p className="font-semibold text-sm">{cfg.icon}</p>
        <p className="font-semibold mt-1">{cfg.title}</p>
        <p className="text-xs mt-1 opacity-80">{cfg.desc}</p>
        <p className="text-xs mt-2 font-mono">Version local: v{versionInfo.localVersion}</p>
      </div>
    );
  };

  // ── Barra de progreso de actualizacion ──
  const renderProgress = () => {
    if (!updating || !updateProgress) return null;
    const isError = updateProgress.step === 'error';
    const isComplete = updateProgress.step === 'complete';
    return (
      <div className={`p-3 rounded-lg border text-sm space-y-2 ${
        isError ? 'bg-red-50 border-red-200' : isComplete ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${updateProgress.percent}%` }}
          />
        </div>
        <p className="text-xs font-medium">{updateProgress.message}</p>
        {isComplete && updateProgress.backupDir && (
          <p className="text-[10px] text-muted-foreground">Respaldo: {updateProgress.backupDir}</p>
        )}
        {(isComplete || isError) && (
          <button
            onClick={() => setUpdateProgress(null)}
            className="text-xs text-primary underline"
          >
            Cerrar
          </button>
        )}
      </div>
    );
  };

  // ── Lista de versiones disponibles ──
  const renderVersionList = () => {
    if (!versionInfo || versionInfo.status !== 'ok' || versionInfo.versions.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            Todas las versiones disponibles ({versionInfo.totalVersions})
          </p>
          <a
            href={versionInfo.releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline"
          >
            Ver en GitHub
          </a>
        </div>

        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {versionInfo.versions.map((ver) => {
            const isExpanded = expandedVersion === ver.version;
            return (
              <div
                key={ver.version}
                className={`rounded-lg border text-xs ${
                  ver.isCurrent
                    ? 'bg-blue-50 border-blue-300'
                    : ver.isNewer
                      ? 'bg-green-50/50 border-green-200'
                      : 'bg-muted/30 border-gray-200'
                }`}
              >
                <div
                  className="flex items-center justify-between p-2.5 cursor-pointer"
                  onClick={() => setExpandedVersion(isExpanded ? null : ver.version)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">v{ver.version}</span>
                    {ver.isCurrent && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-blue-200 text-blue-800">Instalada</Badge>
                    )}
                    {ver.prerelease && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">Beta</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{ver.dateRelative}</span>
                    <span className={`text-[10px] ${isExpanded ? 'rotate-180' : ''} transition-transform`}>▼</span>
                  </div>
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 space-y-2 border-t border-gray-200/50 pt-2">
                    {/* Notas de la version */}
                    {ver.notes && (
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-white/50 rounded p-2 max-h-[120px] overflow-y-auto">
                        {ver.notes}
                      </div>
                    )}

                    {/* Botones de accion */}
                    <div className="flex gap-1.5">
                      {!ver.isCurrent && !updating && (
                        <button
                          onClick={(e) => { e.stopPropagation(); installVersion(ver); }}
                          className={`flex-1 text-center rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                            ver.isNewer
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-orange-500 text-white hover:bg-orange-600'
                          }`}
                        >
                          {ver.isNewer ? 'Actualizar' : 'Restaurar'}
                        </button>
                      )}
                      <a
                        href={ver.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-[11px] font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Descargar ZIP
                      </a>
                    </div>

                    {/* Instrucciones local */}
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <p className="font-medium">Instalacion manual:</p>
                      <p>1. Descargue el ZIP</p>
                      <p>2. Coloquelo en la carpeta del sistema</p>
                      <p>3. Ejecute ACTUALIZAR.bat (doble clic)</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Boton principal */}
      <Button
        variant="outline"
        className="w-full text-sm"
        onClick={checkVersion}
        disabled={checking || updating}
      >
        {checking ? 'Verificando...' : updating ? 'Actualizando en progreso...' : 'Buscar Actualizaciones'}
      </Button>

      {/* Estado de error/no conexion */}
      {renderStatus()}

      {/* Barra de progreso */}
      {renderProgress()}

      {/* Info de versiones */}
      {versionInfo && versionInfo.status === 'ok' && (
        <div className={`p-3 rounded-lg border text-sm space-y-2 ${
          versionInfo.hasUpdate
            ? 'bg-green-50 border-green-200'
            : 'bg-muted/50'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Version instalada:</span>
            <span className="font-mono font-bold">v{versionInfo.localVersion}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Version mas reciente:</span>
            <span className="font-mono font-bold">v{versionInfo.latestVersion}</span>
          </div>

          {versionInfo.hasUpdate ? (
            <div className="pt-2 space-y-2">
              <p className="font-semibold text-green-700">
                Hay {versionInfo.versions.filter(v => v.isNewer).length} nueva(s) version(es) disponible(s)!
              </p>
              {!updating && updateProgress?.step !== 'complete' && (
                <button
                  onClick={() => {
                    const latest = versionInfo.versions.find(v => v.isNewer);
                    if (latest) installVersion(latest);
                  }}
                  className="block w-full text-center bg-green-600 text-white rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-green-700 transition-colors"
                >
                  Actualizar a la Ultima Version (Automatico)
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground pt-1">
              Su sistema esta en la version mas reciente
            </p>
          )}
        </div>
      )}

      {/* Lista de todas las versiones */}
      {renderVersionList()}
    </div>
  );
}

export default function ConfigTab({ settings, onSettingsChange, licenseFeatures }: ConfigTabProps) {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress || "");
  const [storePhone, setStorePhone] = useState(settings.storePhone || "");
  const [storeRif, setStoreRif] = useState(settings.storeRif || "");
  const [bcvRate, setBcvRate] = useState((settings.bcvRate ?? 36.5).toString());
  const [euroUsdtRate, setEuroUsdtRate] = useState((settings.euroUsdtRate ?? 0).toString());
  const [taxRate, setTaxRate] = useState(settings.taxRate.toString());
  const [currency, setCurrency] = useState(settings.currency);
  const [allowZeroStock, setAllowZeroStock] = useState(settings.allowZeroStock || false);
  const [enableDiscount, setEnableDiscount] = useState(settings.enableDiscount || false);
  const [maxDiscountPct, setMaxDiscountPct] = useState((settings.maxDiscountPct || 20).toString());
  const [saving, setSaving] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [theme, setTheme] = useState(settings.theme || 'blue');
  const [themeMode, setThemeMode] = useState(settings.themeMode || 'light');
  // Ticket settings
  const [ticketFontSize, setTicketFontSize] = useState(() => {
    const preset = getPreset(settings.ticketPaperWidth || '58mm');
    const val = settings.ticketFontSize || preset.baseFontSize;
    return Math.min(val, preset.maxFontSize);
  });
  const [ticketFontFamily, setTicketFontFamily] = useState(settings.ticketFontFamily || 'monospace');
  const [ticketHeaderMsg, setTicketHeaderMsg] = useState(settings.ticketHeaderMsg || '');
  const [ticketFooterMsg, setTicketFooterMsg] = useState(settings.ticketFooterMsg || 'Gracias por su compra!');
  const [ticketShowPhone, setTicketShowPhone] = useState(settings.ticketShowPhone !== false);
  const [ticketShowSeller, setTicketShowSeller] = useState(settings.ticketShowSeller !== false);
  const [ticketShowExchange, setTicketShowExchange] = useState(settings.ticketShowExchange !== false);
  const [ticketCurrencyMode, setTicketCurrencyMode] = useState(settings.ticketCurrencyMode || "dual");
  const [ticketShowSlogan, setTicketShowSlogan] = useState(settings.ticketShowSlogan === true);
  const [ticketBold, setTicketBold] = useState(settings.ticketBold !== false);
  const [ticketPaperWidth, setTicketPaperWidth] = useState(settings.ticketPaperWidth || '58mm');
  const [ticketMarginLeft, setTicketMarginLeft] = useState(settings.ticketMarginLeft ?? 0);
  const [ticketMarginRight, setTicketMarginRight] = useState(settings.ticketMarginRight ?? 0);
  const [ticketUseAgent, setTicketUseAgent] = useState(settings.ticketUseAgent !== false);
  const [ticketAgentUrl, setTicketAgentUrl] = useState(settings.ticketAgentUrl || 'http://localhost:9100');
  const [ticketShowCashReceived, setTicketShowCashReceived] = useState(settings.ticketShowCashReceived !== false);
  const [ticketShowLogo, setTicketShowLogo] = useState(settings.ticketShowLogo !== false);
  const [agentStatus, setAgentStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [agentInfo, setAgentInfo] = useState<any>(null);
  const [storeLogo, setStoreLogo] = useState(settings.storeLogo || '');
  const [businessType, setBusinessType] = useState(settings.businessType || 'general');
  const [taxMode, setTaxMode] = useState(settings.taxMode || 'included');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync theme from settings
  useEffect(() => {
    setTheme(settings.theme || 'blue');
    setThemeMode(settings.themeMode || 'light');
    setEuroUsdtRate(String(settings.euroUsdtRate ?? 0));
  }, [settings.theme, settings.themeMode, settings.euroUsdtRate]);

  // Auto-clamp fontSize when paper width changes
  useEffect(() => {
    const preset = getPreset(ticketPaperWidth);
    if (ticketFontSize > preset.maxFontSize) {
      setTicketFontSize(preset.maxFontSize);
    }
  }, [ticketPaperWidth]);

  // Check agent status on mount and when URL changes
  const checkAgent = async () => {
    setAgentStatus('unknown');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await authFetch('/api/print-agent', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setAgentStatus('online');
        setAgentInfo(data);
      } else {
        setAgentStatus('offline');
        setAgentInfo(null);
      }
    } catch {
      setAgentStatus('offline');
      setAgentInfo(null);
    }
  };

  useEffect(() => {
    if (ticketUseAgent) checkAgent();
  }, [ticketUseAgent, ticketAgentUrl]);

  const canAutoBackup = licenseFeatures?.autoBackup || false;
  const canExportImport = licenseFeatures?.exportImport || false;
  const canZeroStock = licenseFeatures?.allowZeroStockConfig || false;
  const canDiscount = licenseFeatures?.productDiscount || false;

  // Tipos de negocio con iconos SVG embebidos
  const BUSINESS_TYPES = [
    { id: 'general', label: 'General', emoji: '🏪' },
    { id: 'panaderia', label: 'Panaderia', emoji: '🥖' },
    { id: 'pasteleria', label: 'Pasteleria', emoji: '🧁' },
    { id: 'carniceria', label: 'Carniceria', emoji: '🥩' },
    { id: 'farmacia', label: 'Farmacia', emoji: '💊' },
    { id: 'supermercado', label: 'Supermercado', emoji: '🛒' },
    { id: 'restaurante', label: 'Restaurante', emoji: '🍽️' },
    { id: 'cafe', label: 'Cafe', emoji: '☕' },
    { id: 'ferreteria', label: 'Ferreteria', emoji: '🔧' },
    { id: 'ropa', label: 'Ropa', emoji: '👕' },
    { id: 'zapateria', label: 'Zapateria', emoji: '👟' },
    { id: 'optica', label: 'Optica', emoji: '👓' },
    { id: 'licoreria', label: 'Licoreria', emoji: '🍷' },
    { id: 'beauty', label: 'Belleza', emoji: '💄' },
    { id: 'veterinaria', label: 'Veterinaria', emoji: '🐾' },
    { id: 'papelera', label: 'Papeleria', emoji: '📝' },
    { id: 'moto', label: 'Moto/Taller', emoji: '🏍️' },
    { id: 'computadora', label: 'Computacion', emoji: '💻' },
    { id: 'celular', label: 'Celulares', emoji: '📱' },
    { id: 'electricidad', label: 'Electricidad', emoji: '⚡' },
    { id: 'gasolina', label: 'Gasolina', emoji: '⛽' },
    { id: 'verdura', label: 'Verduleria', emoji: '🥬' },
    { id: 'polleria', label: 'Polleria', emoji: '🍗' },
    { id: 'pescaderia', label: 'Pescaderia', emoji: '🐟' },
    { id: 'fruteria', label: 'Fruteria', emoji: '🍎' },
    { id: 'jugueria', label: 'Jugueria', emoji: '🧃' },
    { id: 'panchos', label: 'Panchos', emoji: '🌭' },
    { id: 'pizza', label: 'Pizza', emoji: '🍕' },
    { id: 'repuestos', label: 'Repuestos', emoji: '🔩' },
    { id: 'transporte', label: 'Transporte', emoji: '🚗' },
    { id: 'boutique', label: 'Boutique', emoji: '👗' },
    { id: 'joyeria', label: 'Joyeria', emoji: '💍' },
    { id: 'abarrotes', label: 'Abarrotes', emoji: '🛍️' },
    { id: 'carnes', label: 'Carnes', emoji: '🥩' },
    { id: 'dulceria', label: 'Dulceria', emoji: '🍬' },
    { id: 'fotografia', label: 'Fotografia', emoji: '📸' },
    { id: 'heladeria', label: 'Heladeria', emoji: '🍦' },
    { id: 'imprenta', label: 'Imprenta', emoji: '🖨️' },
    { id: 'libreria', label: 'Libreria', emoji: '📚' },
    { id: 'loteria', label: 'Loteria', emoji: '🎰' },
    { id: 'lubricentro', label: 'Lubricentro', emoji: '🛢️' },
    { id: 'market', label: 'Market', emoji: '🏬' },
    { id: 'muebles', label: 'Muebles', emoji: '🛋️' },
    { id: 'musica', label: 'Musica', emoji: '🎵' },
    { id: 'nutricion', label: 'Nutricion', emoji: '🥗' },
    { id: 'paintball', label: 'Paintball', emoji: '🎯' },
    { id: 'peluqueria', label: 'Peluqueria', emoji: '💇' },
    { id: 'regalos', label: 'Regalos', emoji: '🎁' },
    { id: 'smarthphone', label: 'Smartphone', emoji: '📲' },
    { id: 'tacos', label: 'Tacos', emoji: '🌮' },
    { id: 'tintoreria', label: 'Tintoreria', emoji: '👔' },
    { id: 'videojuegos', label: 'Videojuegos', emoji: '🎮' },
  ];

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamano
    if (file.size > 512 * 1024) {
      toast.error('Imagen demasiado grande. Maximo 512KB');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await authFetch('/api/store-logo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setStoreLogo(data.url);
        // Auto-guardar en Settings para persistir el logo
        try {
          await authFetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...settings, storeLogo: data.url }),
          });
        } catch { /* silent */ }
        toast.success('Logo guardado correctamente');
      } else {
        toast.error(data.error || 'Error al subir logo');
      }
    } catch {
      toast.error('Error al subir logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload: any = {
        storeName,
        bcvRate: parseFloat(bcvRate),
        euroUsdtRate: parseFloat(euroUsdtRate) || 0,
        taxRate: parseFloat(taxRate || "0"),
        currency,
        storeAddress,
        storePhone,
        storeRif,
        allowZeroStock,
        enableDiscount,
        maxDiscountPct: parseInt(maxDiscountPct) || 20,
        theme: theme || 'blue',
        themeMode: themeMode || 'light',
        ticketFontSize,
        ticketFontFamily,
        ticketHeaderMsg,
        ticketFooterMsg,
        ticketShowPhone,
        ticketShowSeller,
        ticketShowExchange,
        ticketCurrencyMode,
        ticketShowSlogan,
        ticketBold,
        ticketPaperWidth,
        ticketMarginLeft: parseFloat(String(ticketMarginLeft)),
        ticketMarginRight: parseFloat(String(ticketMarginRight)),
        ticketUseAgent,
        ticketAgentUrl: ticketAgentUrl.replace(/\/+$/, ''),
        ticketShowCashReceived,
        ticketShowLogo,
        storeLogo,
        businessType,
        taxMode,
      };

      const res = await authFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSettingsChange(data);
      toast.success("Configuracion guardada");
    } catch (error: any) {
      toast.error(error.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const loadBackupStatus = async () => {
    try {
      const res = await authFetch("/api/backup/auto");
      const data = await res.json();
      setBackupStatus(data);
    } catch {
      toast.error("Error al obtener estado de respaldos");
    }
  };

  const forceBackup = async () => {
    try {
      const res = await authFetch("/api/backup/auto", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Respaldo creado: " + data.filename);
      loadBackupStatus();
    } catch (error: any) {
      toast.error(error.message || "Error al forzar respaldo");
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await authFetch("/api/backup");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `myecommerce_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Datos exportados");
    } catch {
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Restaurar datos desde archivo? Esto reemplazara TODOS los datos actuales.")) {
      e.target.value = "";
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await authFetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success("Datos restaurados correctamente. Recargue la pagina.");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      toast.error(error.message || "Error al importar datos");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* ====== Paleta de Colores ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
            Apariencia del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme mode selector: Light / Dark / Professional */}
          <div>
            <label className="text-sm font-medium mb-2 block">Modo de Interfaz</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'light', name: 'Claro', icon: '☀️', desc: 'Modo dia clasico' },
                { id: 'dark', name: 'Oscuro', icon: '🌙', desc: 'Modo noche, descanso visual' },
                { id: 'professional', name: 'Profesional', icon: '💼', desc: 'Elegante y corporativo' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setThemeMode(m.id);
                    // Apply immediately without saving
                    if (m.id === 'dark') {
                      document.documentElement.classList.add('dark');
                      document.documentElement.removeAttribute('data-mode');
                    } else if (m.id === 'professional') {
                      document.documentElement.classList.remove('dark');
                      document.documentElement.setAttribute('data-mode', 'professional');
                    } else {
                      document.documentElement.classList.remove('dark');
                      document.documentElement.removeAttribute('data-mode');
                    }
                  }}
                  className={`relative p-3 rounded-xl border-2 text-center transition-all hover:scale-[1.02] ${
                    themeMode === m.id
                      ? 'border-primary shadow-lg scale-[1.02] bg-primary/5'
                      : 'border-muted hover:border-primary/30'
                  }`}
                >
                  <span className="text-2xl block">{m.icon}</span>
                  <span className="text-sm font-medium block mt-1">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground block">{m.desc}</span>
                  {themeMode === m.id && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <p className="text-sm text-muted-foreground">
            Seleccione el color principal de su sistema. El cambio se aplicara inmediatamente a toda la interfaz.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'blue', name: 'Azul', color: '#3b82f6', desc: 'Clasico y profesional' },
              { id: 'green', name: 'Verde', color: '#10b981', desc: 'Fresco y natural' },
              { id: 'red', name: 'Rojo', color: '#ef4444', desc: 'Vibrante y energico' },
              { id: 'purple', name: 'Purpura', color: '#8b5cf6', desc: 'Elegante y moderno' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  document.documentElement.setAttribute('data-theme', t.id);
                }}
                className={`relative p-4 rounded-xl border-2 text-center transition-all hover:scale-[1.02] ${
                  theme === t.id
                    ? 'border-current shadow-lg scale-[1.02]'
                    : 'border-muted hover:border-current/30'
                }`}
                style={{ color: t.color, borderColor: theme === t.id ? t.color : undefined }}
              >
                <div className="w-10 h-10 rounded-full mx-auto mb-2 shadow-md" style={{ backgroundColor: t.color }} />
                <span className="text-sm font-medium block" style={{ color: theme === t.id ? t.color : undefined }}>
                  {t.name}
                </span>
                <span className="text-[10px] text-muted-foreground block">{t.desc}</span>
                {theme === t.id && (
                  <div className="absolute top-1.5 right-1.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ====== Configuracion de la Tienda ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuracion de la Tienda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nombre de la Tienda</Label>
            <Input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Nombre de tu negocio"
            />
          </div>

          {/* ====== Logo del Negocio + Tipo de Negocio ====== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Logo del Negocio</Label>
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-white dark:bg-gray-800 shrink-0">
                  {storeLogo ? (
                    <img
                      crossOrigin="anonymous"
                      src={storeLogo}
                      alt="Logo"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-3xl">
                      {BUSINESS_TYPES.find(b => b.id === businessType)?.emoji || '🏪'}
                    </span>
                  )}
                  {storeLogo && (
                    <button
                      type="button"
                      onClick={() => setStoreLogo('')}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 shadow"
                      title="Quitar logo"
                    >
                      x
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      uploadingLogo
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                    }`}>
                      {uploadingLogo ? 'Subiendo...' : 'Subir Logo'}
                    </div>
                  </label>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF o WEBP (max 512KB)</p>
                  {!storeLogo && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Se usara el icono del tipo de negocio como logo en el ticket
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tipo de Negocio */}
            <div className="space-y-2">
              <Label>Tipo de Negocio</Label>
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-0.5 max-h-24 overflow-y-auto p-1 border rounded-md bg-gray-50 dark:bg-gray-900">
                {BUSINESS_TYPES.map((bt) => (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => setBusinessType(bt.id)}
                    title={bt.label}
                    className={`flex items-center justify-center w-full aspect-square rounded text-sm transition-all ${
                      businessType === bt.id
                        ? 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700 scale-105 shadow-sm'
                        : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {bt.emoji}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{BUSINESS_TYPES.find(b => b.id === businessType)?.emoji || '🏪'}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {BUSINESS_TYPES.find(b => b.id === businessType)?.label || 'General'}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>RIF / CI</Label>
              <Input
                value={storeRif}
                onChange={(e) => setStoreRif(e.target.value)}
                placeholder="J-00000000-0"
              />
            </div>
            <div>
              <Label>Telefono</Label>
              <Input
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                placeholder="+58 412-1234567"
              />
            </div>
            <div>
              <Label>Direccion</Label>
              <Input
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="Direccion del local"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Tasa BCV (1 USD = ? Bs)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={bcvRate}
                onChange={(e) => setBcvRate(e.target.value)}
                placeholder="36.50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tasa actualizada del Banco Central de Venezuela
              </p>
            </div>
            <div>
              <Label>Tasa Euro/USDT (1 USD = ? Bs)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={euroUsdtRate}
                onChange={(e) => setEuroUsdtRate(e.target.value)}
                placeholder="0 = desactivado"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tasa paralela para calculo de Gran Mayor (0 = desactivado)
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Impuesto IVA (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Coloca aqui el porcentaje actual de IVA. Si el Estado lo cambia, solo actualiza este valor y el sistema recalcula automaticamente en todas las ventas. 0% si no aplica.
              </p>
            </div>
          </div>

          {/* ====== Configuracion de IVA ====== */}
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-lg">🧾</span> Configuracion de IVA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Como manejar el IVA al vender?</Label>
                <p className="text-xs text-muted-foreground">
                  Define si el IVA esta desglosado dentro del precio de venta o se suma al precio.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setTaxMode('included')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      taxMode === 'included'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="font-semibold text-sm">Desglosado del precio</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      El IVA esta incluido en el precio de venta.
                      <br />
                      <strong>Ej:</strong> Producto a $1.00 → IVA 16% = $0.14 del precio, base imponible $0.86
                    </div>
                    {taxMode === 'included' && (
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">Seleccionado</div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode('added')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      taxMode === 'added'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="font-semibold text-sm">Sumado al precio</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      El IVA se suma al precio de venta.
                      <br />
                      <strong>Ej:</strong> Producto a $1.00 + IVA 16% = Cliente paga $1.16
                    </div>
                    {taxMode === 'added' && (
                      <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">Seleccionado</div>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Nota:</strong> Esta configuracion aplica al momento de la venta. El porcentaje de IVA
                  se toma del campo "Impuesto IVA (%)" arriba. Si un producto esta marcado como "Exento",
                  no se le aplicara IVA independientemente del valor configurado. Si el Estado cambia el impuesto,
                  solo actualiza el valor y el sistema recalcula automaticamente.
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">IVA por defecto al crear producto:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  taxMode === 'included' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                }`}>
                  {taxMode === 'included' ? 'Desglosado' : 'Sumado'}
                </span>
              </div>
            </CardContent>
          </Card>
          <div>
            <Label>Moneda Principal</Label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? "Guardando..." : "Guardar Configuracion"}
          </Button>
        </CardContent>
      </Card>

      {/* ====== Configuracion de Ventas ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuracion de Ventas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle: Venta con Stock en 0 */}
          <div className={`p-4 rounded-lg border ${canZeroStock ? "bg-background" : "bg-muted/50 opacity-70"}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="font-medium">Permitir venta con stock en 0</Label>
                  {!canZeroStock && (
                    <Badge variant="destructive" className="text-[8px]">BASICA+</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Al activar esta opcion, se permitira facturar productos incluso cuando su stock sea 0 o negativo.
                  Si esta desactivada, el sistema bloqueara la venta de productos sin stock disponible.
                </p>
              </div>
              <label className={`relative inline-flex items-center cursor-pointer ${!canZeroStock ? 'pointer-events-none' : ''}`}>
                <input
                  type="checkbox"
                  checked={allowZeroStock}
                  onChange={(e) => setAllowZeroStock(e.target.checked)}
                  disabled={!canZeroStock}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>
            {allowZeroStock && (
              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                <span className="font-semibold">&#9888; Precaucion:</span> El stock de los productos podria quedar en negativo.
                Active esta opcion solo si maneja pedidos o entregas futuras.
              </div>
            )}
          </div>

          <Separator />

          {/* Toggle: Descuentos */}
          <div className={`p-4 rounded-lg border ${canDiscount ? "bg-background" : "bg-muted/50 opacity-70"}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="font-medium">Permitir descuentos en ventas</Label>
                  {!canDiscount && (
                    <Badge variant="destructive" className="text-[8px]">BASICA+</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Permite a los cajeros aplicar descuentos en dolares a las ventas.
                  Puede limitar el porcentaje maximo de descuento permitido.
                </p>
              </div>
              <label className={`relative inline-flex items-center cursor-pointer ${!canDiscount ? 'pointer-events-none' : ''}`}>
                <input
                  type="checkbox"
                  checked={enableDiscount}
                  onChange={(e) => setEnableDiscount(e.target.checked)}
                  disabled={!canDiscount}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>
            {enableDiscount && canDiscount && (
              <div className="mt-3 flex items-center gap-3">
                <Label className="text-sm whitespace-nowrap">Descuento maximo (%):</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={maxDiscountPct}
                  onChange={(e) => setMaxDiscountPct(e.target.value)}
                  className="w-24 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  El cajero no podra aplicar mas del {maxDiscountPct}% de descuento
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ====== Configuracion de Ticket / Impresora ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Configuracion de Ticket
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Personalice el formato del ticket de venta que se imprime en la impresora termica. Los cambios se aplicaran en el proximo ticket generado.
          </p>

          {/* Tamano y tipo de letra */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Ancho de Papel</Label>
              <select
                value={ticketPaperWidth}
                onChange={(e) => setTicketPaperWidth(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="80mm">80mm (Ticket estandar)</option>
                <option value="58mm">58mm (Ticket pequeno)</option>
                <option value="57mm">57mm (Ticket pequeño - POS moviles)</option>
                <option value="55mm">55mm (Ticket compacto)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {ticketPaperWidth === '55mm' ? '55mm: el mas compacto, ideal para impresoras con margen estrecho.' 
                  : ticketPaperWidth === '57mm' ? '57mm: estandar en impresoras moviles/portatiles, ligeramente mas estrecho que 58mm.'
                  : ticketPaperWidth === '58mm' ? '58mm: columna reducida, texto compacto.' 
                  : '80mm: formato completo, ideal para tiendas grandes.'}
              </p>
            </div>
            <div>
              <Label>Tamano de letra (px)</Label>
              <select
                value={ticketFontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  const preset = getPreset(ticketPaperWidth);
                  const clamped = Math.min(val, preset.maxFontSize);
                  setTicketFontSize(clamped);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {(() => {
                  const preset = getPreset(ticketPaperWidth);
                  const opts: { value: number; label: string }[] = [];
                  for (let s = 5; s <= 20; s++) {
                    const enabled = s <= preset.maxFontSize;
                    opts.push({ value: s, label: `${s}px${enabled ? '' : ' (no disponible)'}` });
                  }
                  return opts.map(o => (
                    <option key={o.value} value={o.value} disabled={o.value > preset.maxFontSize}>
                      {o.label}
                    </option>
                  ));
                })()}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Maximo para {ticketPaperWidth}: <strong>{getPreset(ticketPaperWidth).maxFontSize}px</strong>.
                Ancho util: {getPreset(ticketPaperWidth).contentMm}mm.
                Rango: {getPreset(ticketPaperWidth).minFontSize}px - {getPreset(ticketPaperWidth).maxFontSize}px.
                Ancho util: {getPreset(ticketPaperWidth).contentMm}mm.
                ~{calcMaxChars(getPreset(ticketPaperWidth).contentMm, ticketFontSize)} chars por linea.
              </p>
            </div>
            <div>
              <Label>Tipo de letra</Label>
              <select
                value={ticketFontFamily}
                onChange={(e) => setTicketFontFamily(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="monospace">Monospace (Clasico ticket)</option>
                <option value="Arial, sans-serif">Arial (Sans-serif)</option>
                <option value="Courier New, monospace">Courier New</option>
                <option value="Tahoma, sans-serif">Tahoma</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Monospace es el formato clasico de impresoras termicas.
              </p>
            </div>
          </div>

          <Separator />

          {/* Mensajes personalizados */}
          <div className="space-y-3">
            <div>
              <Label>Mensaje de Encabezado (opcional)</Label>
              <Textarea
                value={ticketHeaderMsg}
                onChange={(e) => setTicketHeaderMsg(e.target.value)}
                placeholder='Ej: *** FACTURA DE VENTA *** o deje vacio para ocultar'
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Aparece debajo del nombre de la tienda. Ideal para "FACTURA", "NOTA DE ENTREGA", etc.
              </p>
            </div>
            <div>
              <Label>Mensaje de Pie de Pagina</Label>
              <Textarea
                value={ticketFooterMsg}
                onChange={(e) => setTicketFooterMsg(e.target.value)}
                placeholder="Gracias por su compra!"
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mensaje al final del ticket. Puede incluir eslogan, redes sociales, promociones, etc.
              </p>
            </div>
          </div>

          <Separator />

          {/* Modo de moneda en ticket */}
          <div>
            <Label>Moneda en Ticket</Label>
            <select
              value={ticketCurrencyMode}
              onChange={(e) => setTicketCurrencyMode(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="dual">Bs y USD (ambos montos)</option>
              <option value="bs_only">Solo Bolivares (Bs)</option>
              <option value="usd_only">Solo Dolares ($)</option>
              <option value="unit_bs_total_usd">Precio unit. en Bs, Total en $</option>
              <option value="unit_usd_total_bs">Precio unit. en $, Total en Bs</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {ticketCurrencyMode === 'dual' ? 'Muestra precios y totales en Bs, mas linea con USD y tasa.'
                : ticketCurrencyMode === 'bs_only' ? 'Todo en bolivares: precios unitarios, totales de articulo y total final.'
                : ticketCurrencyMode === 'usd_only' ? 'Todo en dolares: precios unitarios, totales de articulo y total final.'
                : ticketCurrencyMode === 'unit_bs_total_usd' ? 'Precio unitario en Bs, total de cada articulo y total final en USD.'
                : 'Precio unitario en USD, total de cada articulo y total final en Bs.'}
            </p>
          </div>

          <Separator />

          {/* Toggle switches */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Secciones del Ticket</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <Label className="font-medium text-sm">Mostrar Telefono</Label>
                  <p className="text-xs text-muted-foreground">Telefono de la tienda en el ticket</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={ticketShowPhone} onChange={(e) => setTicketShowPhone(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <Label className="font-medium text-sm">Mostrar Vendedor</Label>
                  <p className="text-xs text-muted-foreground">Nombre del cajero/vendedor</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={ticketShowSeller} onChange={(e) => setTicketShowSeller(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <Label className="font-medium text-sm">Mostrar Tasa de Cambio</Label>
                  <p className="text-xs text-muted-foreground">Tasa BCV y equivalente en USD</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={ticketShowExchange} onChange={(e) => setTicketShowExchange(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <Label className="font-medium text-sm">Mensaje Destacado</Label>
                  <p className="text-xs text-muted-foreground">Pie de pagina con bordes dobles</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={ticketShowSlogan} onChange={(e) => setTicketShowSlogan(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <Label className="font-medium text-sm">Imprimir en Negrita</Label>
                  <p className="text-xs text-muted-foreground">Todo en negrita para impresoras que imprimen claro</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={ticketBold} onChange={(e) => setTicketBold(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              {/* Monto recibido y vuelto eliminados permanentemente del ticket */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <Label className="font-medium text-sm">Mostrar Logo</Label>
                  <p className="text-xs text-muted-foreground">Muestra el logo del negocio en el ticket</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={ticketShowLogo} onChange={(e) => setTicketShowLogo(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Margenes del ticket */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Margenes del Ticket (mm)</p>
            <p className="text-xs text-muted-foreground">
              Por defecto ambos margenes estan en <strong>0mm</strong> para que TODO el contenido entre en impresoras de 55/57/58mm. Si el texto se corta en los bordes del papel, aumente el margen correspondiente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">Margen Izquierdo</Label>
                  <span className="text-sm font-bold text-primary">{ticketMarginLeft}mm</span>
                </div>
                <input
                  type="range" min="0" max="5" step="0.5"
                  value={ticketMarginLeft}
                  onChange={(e) => setTicketMarginLeft(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>0mm (recomendado)</span>
                  <span>5mm</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">Margen Derecho</Label>
                  <span className="text-sm font-bold text-primary">{ticketMarginRight}mm</span>
                </div>
                <input
                  type="range" min="0" max="5" step="0.5"
                  value={ticketMarginRight}
                  onChange={(e) => setTicketMarginRight(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>0mm (recomendado)</span>
                  <span>5mm</span>
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <strong>Recomendacion por ancho:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li><strong>55mm:</strong> margen izq 0mm, der 0mm. Si se corta el texto, subir a 0.5mm.</li>
                <li><strong>57mm:</strong> margen izq 0mm, der 0mm. Igual que 55mm.</li>
                <li><strong>58mm:</strong> margen izq 0mm, der 0mm. Si se corta, 1mm izq / 0.5mm der.</li>
                <li><strong>80mm:</strong> margen izq 1-2mm, der 1mm. Espacio amplio, no se corta.</li>
              </ul>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <strong>Importante:</strong> los margenes solo aplican al modo de impresion HTML (fallback). En modo ESC/POS via agente local, la impresora maneja automaticamente el ancho de papel.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== Agente de Impresion ESC/POS ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
            Agente de Impresion ESC/POS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-2.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
            <strong>Recomendado:</strong> El agente local envia comandos directos a la impresora termica via USB/COM. El nombre de la tienda se imprime en GRANDE, el TOTAL nunca se corta, y funciona igual en 55mm, 57mm, 58mm y 80mm sin depender del navegador.
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex-1">
              <Label className="font-medium text-sm">Usar agente de impresion local</Label>
              <p className="text-xs text-muted-foreground">Imprime directamente via ESC/POS (recomendado)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={ticketUseAgent} onChange={(e) => setTicketUseAgent(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          {ticketUseAgent && (
            <div className="space-y-3">
              <div>
                <Label>Direccion del Agente</Label>
                <input
                  type="text"
                  value={ticketAgentUrl}
                  onChange={(e) => setTicketAgentUrl(e.target.value)}
                  placeholder="http://localhost:9100"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL del agente local. Por defecto http://localhost:9100
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={checkAgent}
                  disabled={agentStatus === 'unknown'}
                >
                  {agentStatus === 'unknown' ? 'Verificando...' : 'Probar Conexion'}
                </Button>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${agentStatus === 'online' ? 'bg-green-500' : agentStatus === 'offline' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                  <span className="text-sm">
                    {agentStatus === 'online' ? 'Agente conectado' : agentStatus === 'offline' ? 'Agente no encontrado' : 'Sin verificar'}
                  </span>
                </div>
              </div>

              {agentStatus === 'online' && agentInfo && (
                <div className="p-2.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 space-y-1">
                  <strong>Info del agente:</strong>
                  <p>Version: {agentInfo.version || 'N/A'}</p>
                  <p>Impresora detectada: {agentInfo.autoPrinter || agentInfo.connectedPort || 'No detectada'}</p>
                  <p>Impresiones realizadas: {agentInfo.printCount || 0}</p>
                  <p>Serial disponible: {agentInfo.serialAvailable ? 'Si' : 'No (modo archivo)'}</p>
                </div>
              )}

              {agentStatus === 'offline' && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <strong>El agente no esta activo.</strong> Para instalarlo:
                  <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                    <li>Ejecute <code className="bg-amber-100 px-1 rounded">DETENER-TODO.bat</code></li>
                    <li>Ejecute <code className="bg-amber-100 px-1 rounded">INICIAR-TODO-OCULTO.vbs</code></li>
                    <li>Espere 10 segundos</li>
                    <li>El agente se activa automaticamente con INICIAR-TODO-OCULTO.vbs</li>
                  </ol>
                  <p className="mt-1">Mientras el agente no este activo, el sistema usara la impresion via navegador (fallback).</p>
                </div>
              )}
            </div>
          )}

          {!ticketUseAgent && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <strong>Modo navegador activo (fallback).</strong> La impresion dependera del driver de la impresora en el navegador. Puede que el TOTAL se corte o el nombre de la tienda no se vea correctamente en algunas impresoras. Se recomienda activar el agente local para mejor resultados.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== Respaldo Automatico ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Respaldo Automatico
            {!canAutoBackup && <Badge variant="destructive" className="text-[8px]">BASICA+</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canAutoBackup ? (
            <>
              <p className="text-sm text-muted-foreground">
                El sistema crea respaldos automaticos cada hora en la carpeta <code className="bg-muted px-1 rounded">respaldos/</code>.
                Se conservan los ultimos 7 respaldos.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadBackupStatus}>
                  Ver Estado
                </Button>
                <Button variant="outline" size="sm" onClick={forceBackup}>
                  Forzar Respaldo Ahora
                </Button>
              </div>
              {backupStatus && (
                <div className="mt-2 p-3 rounded border bg-muted/50 text-sm">
                  <p className="font-medium">Estado: {backupStatus.status === "active" ? "Activo" : "Inactivo"}</p>
                  <p className="text-muted-foreground">{backupStatus.total} respaldos disponibles</p>
                  {backupStatus.backups.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {backupStatus.backups.slice(0, 5).map((b) => (
                        <p key={b} className="text-xs text-muted-foreground">{b}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-4 bg-muted/50 rounded text-center">
              <p className="text-sm text-muted-foreground">
                El respaldo automatico esta disponible en los planes BASICA y PROFESIONAL.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Actualice su licencia para habilitar esta funcion.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== Exportar / Importar ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Exportar / Importar Datos
            {!canExportImport && <Badge variant="destructive" className="text-[8px]">BASICA+</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canExportImport ? (
            <>
              <p className="text-sm text-muted-foreground">
                Exporta todos los datos del sistema o importa un respaldo previo.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
                  {exporting ? "Exportando..." : "Exportar Todo (JSON)"}
                </Button>
                <label className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background px-4 py-2 hover:bg-accent cursor-pointer">
                  {importing ? "Importando..." : "Importar Respaldo"}
                  <input
                    type="file"
                    accept=".json"
                    onChange={importData}
                    className="hidden"
                    disabled={importing}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="p-4 bg-muted/50 rounded text-center">
              <p className="text-sm text-muted-foreground">
                La exportacion e importacion de datos esta disponible en los planes BASICA y PROFESIONAL.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== Actualizaciones ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actualizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <VersionChecker />
        </CardContent>
      </Card>

      {/* ====== Soporte ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Soporte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-center space-y-2 py-3">
            <p className="text-muted-foreground">Para pedidos y soporte comuníquese:</p>
            <p className="font-semibold">Desarrollado by Inversiones Valencia Mundonet FP</p>
            <p className="text-primary">
              <a href="mailto:valenciamundonet@gmail.com" className="hover:underline">
                valenciamundonet@gmail.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
