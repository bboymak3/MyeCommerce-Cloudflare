"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface StockWarningDialogProps {
  data: any;
  onClose: () => void;
}

export function StockWarningDialog({ data, onClose }: StockWarningDialogProps) {
  return (
    <Dialog open={!!data} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-destructive">Stock Insuficiente</DialogTitle>
        </DialogHeader>
        {data && (
          <div className="text-center space-y-3">
            <p className="text-sm">Producto sin stock suficiente:</p>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="font-bold">{data.productName}</p>
              <p className="text-xs text-muted-foreground">Disponible: {data.availableStock} | Solicitado: {data.requestedQuantity}</p>
            </div>
            <Button className="w-full" onClick={onClose}>Entendido</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
