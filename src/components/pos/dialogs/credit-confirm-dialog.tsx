"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CreditConfirmDialogProps {
  open: boolean;
  clientName: string;
  clientDebt: number;
  total: number;
  totalBs: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CreditConfirmDialog({ open, clientName, clientDebt, total, totalBs, onCancel, onConfirm }: CreditConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-amber-600">Confirmar Venta Fiada</DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-3">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded">
            <p className="text-sm font-medium text-amber-800">Este cliente ya tiene deuda pendiente</p>
            <p className="text-lg font-bold text-amber-700 mt-1">${clientDebt.toFixed(2)}</p>
          </div>
          <div className="p-2 bg-muted rounded text-xs">
            <p>Venta actual: <strong>${total.toFixed(2)}</strong> = Bs <strong>{totalBs.toFixed(2)}</strong></p>
            <p className="text-muted-foreground">Nueva deuda total: <strong>${(clientDebt + total).toFixed(2)}</strong></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
            <Button className="flex-1" onClick={onConfirm}>Confirmar Credito</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
