"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { METHOD_LABELS } from "../types";

interface ReceiptDialogProps {
  receipt: any;
  storeName: string;
  storeRif: string;
  storeAddress: string;
  bcvRate: number;
  onPrint: (receipt: any) => void;
  onClose: () => void;
}

export function ReceiptDialog({ receipt, storeName, storeRif, storeAddress, bcvRate, onPrint, onClose }: ReceiptDialogProps) {
  if (!receipt) return null;

  return (
    <Dialog open={!!receipt} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Venta Completada</DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-3 text-sm">
          <p className="font-bold text-lg">{storeName}</p>
          {storeRif && <p className="text-xs text-muted-foreground">RIF: {storeRif}</p>}
          {storeAddress && <p className="text-xs text-muted-foreground">{storeAddress}</p>}
          <p className="text-muted-foreground text-xs">{new Date(receipt.date).toLocaleString("es-VE")}</p>
          <Separator />

          {/* Client data */}
          {receipt.clientName && receipt.clientName !== "CLIENTE FINAL" && (
            <div className="text-left bg-muted/30 p-2 rounded text-xs space-y-0.5">
              <p className="font-bold">Cliente:</p>
              <p>{receipt.clientName}</p>
              {receipt.clientDocNumber && <p>CI/RIF: {receipt.clientDocType}-{receipt.clientDocNumber}</p>}
              {receipt.clientAddress && <p>Direccion: {receipt.clientAddress}</p>}
            </div>
          )}
          {receipt.clientName === "CLIENTE FINAL" && (
            <div className="text-left bg-muted/30 p-2 rounded text-xs">
              <p>Consumidor Final: {receipt.clientDocType}-{receipt.clientDocNumber}</p>
            </div>
          )}

          <p>Metodo de pago: {receipt.paymentMethod === "mixto" ? "Mixto" : receipt.paymentMethod}</p>

          {/* Reference */}
          {receipt.referenceNumber && (
            <div className="text-left bg-muted/30 p-2 rounded text-xs">
              <p className="font-medium">Referencia:</p>
              <p className="font-mono">{receipt.referenceNumber}</p>
            </div>
          )}

          {/* Mixed payment breakdown */}
          {receipt.paymentMethod === "mixto" && receipt.mixedPaymentJson && (() => {
            try {
              const entries = JSON.parse(receipt.mixedPaymentJson);
              return (
                <div className="text-left bg-blue-50 p-2 rounded text-xs space-y-1">
                  <p className="font-bold text-blue-800">Desglose de Pago:</p>
                  {entries.map((e: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span>{METHOD_LABELS[e.method] || e.method}:</span>
                      <span>Bs {parseFloat(e.amountBs).toFixed(2)} (${parseFloat(e.amountUsd).toFixed(2)})</span>
                    </div>
                  ))}
                  {entries.some((e: any) => e.reference) && (
                    <div className="mt-1 pt-1 border-t">
                      {entries.filter((e: any) => e.reference).map((e: any, i: number) => (
                        <p key={i} className="text-muted-foreground">{METHOD_LABELS[e.method]} Ref: <span className="font-mono">{e.reference}</span></p>
                      ))}
                    </div>
                  )}
                </div>
              );
            } catch { return null; }
          })()}

          <Separator />

          {/* Items table */}
          <div className="text-left space-y-1">
            <div className="flex justify-between text-xs font-bold border-b pb-1 mb-1">
              <span style={{ width: "40%" }}>Producto</span>
              <span style={{ width: "10%", textAlign: "center" }}>Cant.</span>
              <span style={{ width: "18%", textAlign: "right" }}>P.Uni.</span>
              <span style={{ width: "4%" }}></span>
              <span style={{ width: "18%", textAlign: "right" }}>Total</span>
            </div>
            {receipt.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-xs">
                <span style={{ width: "40%", wordBreak: "break-word", overflowWrap: "break-word" }}>{item.product?.name || "Producto"}</span>
                <span style={{ width: "10%", textAlign: "center" }}>{item.quantity}</span>
                <span style={{ width: "18%", textAlign: "right" }}>${(item.unitPrice || 0).toFixed(2)}</span>
                <span style={{ width: "4%" }}></span>
                <span style={{ width: "18%", textAlign: "right" }}>${item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <Separator />

          {receipt.discount > 0 && (
            <div className="flex justify-between text-destructive text-sm"><span>Descuento:</span><span>-${receipt.discount.toFixed(2)}</span></div>
          )}
          <div className="text-lg font-bold">Total: Bs {receipt.totalBs.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">Total USD: ${receipt.total.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Tasa: 1$ = {receipt.exchangeRate} Bs</p>
          <p className="text-xs font-bold text-muted-foreground">Factura N. {receipt.invoiceNumber || "SIN ASIGNAR"}</p>
          <p className="text-[10px] text-muted-foreground">ID: {receipt.id.slice(0, 8)}</p>

          <div className="flex gap-2 mt-2">
            <Button className="flex-1" onClick={() => onPrint(receipt)}>&#128424; Imprimir Ticket</Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
