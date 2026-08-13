"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

interface QrAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localUrl: string;
}

export function QrAccessDialog({ open, onOpenChange, localUrl }: QrAccessDialogProps) {
  // Extract IP from localUrl (comes as http://192.168.x.x:3000)
  const ipMatch = localUrl ? localUrl.match(/(\d+\.\d+\.\d+\.\d+)/) : null;
  const localIp = ipMatch ? ipMatch[1] : "";
  const mobileUrl = localIp ? `https://${localIp}:8443` : "";
  const domainUrl = "https://myecommerce.ve";

  const [mode, setMode] = useState<"mobile" | "domain">("mobile");

  const displayUrl = mode === "mobile" ? mobileUrl : domainUrl;

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada al portapapeles");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Acceso Movil via QR</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Escanea este codigo con la camara de tu telefono para acceder al TPV desde cualquier dispositivo.
          </p>

          {/* Mode Toggle */}
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setMode("mobile")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border-2 ${
                mode === "mobile"
                  ? "bg-indigo-50 border-indigo-500 text-indigo-800 shadow-sm"
                  : "bg-muted border-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Movil (IP:8443)
            </button>
            <button
              onClick={() => setMode("domain")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border-2 ${
                mode === "domain"
                  ? "bg-green-50 border-green-500 text-green-800 shadow-sm"
                  : "bg-muted border-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Dominio
            </button>
          </div>

          {/* Info banner */}
          {mode === "mobile" && (
            <div className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-xs text-indigo-800 font-medium text-center">
                Modo movil: accede via IP local con HTTPS. Permite usar la camara del telefono como lector de codigos de barra.
                Al primer acceso acepta el certificado en &quot;Avanzado&quot; &gt; &quot;Continuar&quot;.
              </p>
            </div>
          )}
          {mode === "domain" && (
            <div className="w-full p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-800 font-medium text-center">
                Modo dominio: requiere DNS configurada para myecommerce.ve y Caddy ejecutandose con certificado interno.
              </p>
            </div>
          )}

          {displayUrl ? (
            <>
              <div className="p-4 bg-white rounded-xl border-2 shadow-sm">
                <QRCodeSVG value={displayUrl} size={200} level="H" includeMargin={false} />
              </div>
              <div className="text-center space-y-2 w-full">
                <p className="text-xs text-muted-foreground">Direccion de acceso:</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <code className="flex-1 text-sm font-mono font-bold truncate">{displayUrl}</code>
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-shrink-0"
                    onClick={() => copyUrl(displayUrl)}>
                    Copiar
                  </Button>
                </div>
                {mode === "mobile" && !mobileUrl && (
                  <p className="text-[11px] text-orange-600 font-medium">
                    No se pudo detectar la IP local. Verifica que el servidor este activo.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground">Detectando IP local...</p>
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
