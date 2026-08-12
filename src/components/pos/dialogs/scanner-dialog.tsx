"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ScannerDialogProps {
  open: boolean;
  loading: boolean;
  error: string;
  scannerDivId: string;
  search: string;
  onSearchChange: (v: string) => void;
  onClose: () => void;
  onRetry: () => void;
}

export function ScannerDialog({ open, loading, error, scannerDivId, search, onSearchChange, onClose, onRetry }: ScannerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">&#128247; Escanear Codigo de Barras / QR</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground">Iniciando camara...</p>
            </div>
          )}
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-red-500 text-lg flex-shrink-0">&#9888;</span>
                <div className="text-sm text-red-700 space-y-2">
                  <p className="font-semibold">Error con la camara</p>
                  <p>{error}</p>
                  <div className="text-xs text-red-600 bg-red-100 rounded p-2 mt-2">
                    <p className="font-semibold mb-1">Pasos para solucionar:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Haga clic en el icono de candado o camara en la barra de direccion</li>
                      <li>Busque &quot;Camara&quot; y seleccione &quot;Permitir&quot;</li>
                      <li>Recargue la pagina (F5) e intente de nuevo</li>
                      <li>Si usa Chrome: Configuracion &gt; Privacidad &gt; Sitios &gt; Camara</li>
                    </ol>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>Cerrar</Button>
                <Button className="flex-1" onClick={onRetry}>Reintentar</Button>
              </div>
            </div>
          )}
          {!loading && !error && (
            <>
              <div id={scannerDivId} className="rounded-lg overflow-hidden" style={{ minHeight: "250px" }} />
              <style>{`
                #${scannerDivId} img[alt="Info icon"] { display: none !important; }
                #${scannerDivId} button { display: none !important; }
                #${scannerDivId} #qr-shaded-region { border-color: rgba(34,197,94,0.5) !important; }
              `}</style>
              <p className="text-xs text-center text-muted-foreground">Apunte la camara hacia el codigo de barras o QR.</p>
            </>
          )}
          <p className="text-xs text-center text-muted-foreground">Tambien puede escribir el codigo manualmente:</p>
          <Input placeholder="Escribir codigo manualmente..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="font-mono text-center" />
          <Button variant="outline" className="w-full" onClick={onClose}>Cerrar Scanner</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
