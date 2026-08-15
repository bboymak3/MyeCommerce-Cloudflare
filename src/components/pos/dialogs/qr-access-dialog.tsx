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
  secureUrl: string;
}

export function QrAccessDialog({ open, onOpenChange, localUrl }: QrAccessDialogProps) {
  // Solo HTTP — acceso movil sin certificados
  const activeUrl = localUrl;

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

          {/* Info banner */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 w-full">
            <p className="text-[10px] text-blue-700 dark:text-blue-400 text-center font-medium">
              Modo HTTP : Acceso directo via red local.
            </p>
            <p className="text-[10px] text-blue-600 dark:text-blue-500 text-center mt-1">
              Solo accesible desde dispositivos en la misma red WiFi/Local.
            </p>
          </div>

          {activeUrl ? (
            <>
              <div className="p-4 bg-white rounded-xl border-2 shadow-sm">
                <QRCodeSVG value={activeUrl} size={200} level="H" includeMargin={false} />
              </div>
              <div className="text-center space-y-2 w-full">
                <p className="text-xs text-muted-foreground">Direccion de acceso:</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <code className="flex-1 text-sm font-mono font-bold truncate">{activeUrl}</code>
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-shrink-0"
                    onClick={() => { navigator.clipboard.writeText(activeUrl); toast.success("URL copiada al portapapeles"); }}>
                    Copiar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Solo accesible desde dispositivos en la misma red WiFi/Local.
                </p>
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
