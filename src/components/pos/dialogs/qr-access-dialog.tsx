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
  const [useHttps, setUseHttps] = useState(true);

  // Derive URLs
  const httpUrl = localUrl || "";
  // Extract IP and port from local URL to build HTTPS version
  const secureUrl = "https://myecommerce.ve";
  const displayUrl = useHttps ? secureUrl : httpUrl;

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

          {/* Protocol Toggle */}
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setUseHttps(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border-2 ${
                useHttps
                  ? "bg-green-50 border-green-500 text-green-800 shadow-sm"
                  : "bg-muted border-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              HTTPS (Recomendado)
            </button>
            <button
              onClick={() => setUseHttps(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all border-2 ${
                !useHttps
                  ? "bg-blue-50 border-blue-500 text-blue-800 shadow-sm"
                  : "bg-muted border-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              HTTP (IP Local)
            </button>
          </div>

          {/* Info banner */}
          {useHttps && (
            <div className="w-full p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-800 font-medium text-center">
                El modo HTTPS permite usar la camara del telefono para escanear codigos de barra y tomar fotos de productos.
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
                    onClick={() => { navigator.clipboard.writeText(displayUrl); toast.success("URL copiada al portapapeles"); }}>
                    Copiar
                  </Button>
                </div>
                {useHttps && (
                  <p className="text-[11px] text-muted-foreground">
                    Requiere que Caddy este ejecutandose para redirigir el trafico HTTPS a la app.
                  </p>
                )}
                {!useHttps && (
                  <p className="text-[11px] text-muted-foreground">
                    Solo accesible desde dispositivos conectados a la misma red WiFi/Local.
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
