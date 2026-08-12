"use client";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Acceso Movil via QR</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Escanea este codigo QR con la camara de tu telefono para acceder al TPV desde cualquier dispositivo de la red local.
          </p>
          {localUrl ? (
            <>
              <div className="p-4 bg-white rounded-xl border-2 shadow-sm">
                <QRCodeSVG value={localUrl} size={200} level="H" includeMargin={false} />
              </div>
              <div className="text-center space-y-2 w-full">
                <p className="text-xs text-muted-foreground">Direccion de acceso:</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <code className="flex-1 text-sm font-mono font-bold truncate">{localUrl}</code>
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-shrink-0"
                    onClick={() => { navigator.clipboard.writeText(localUrl); toast.success("URL copiada al portapapeles"); }}>
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
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
