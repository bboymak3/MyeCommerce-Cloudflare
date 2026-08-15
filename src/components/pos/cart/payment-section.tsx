"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Banknote, DollarSign, Smartphone, CreditCard, QrCode, Building, Landmark, ArrowLeftRight } from 'lucide-react';
import type { ClientData, MixedEntry } from "../types";
import { USD_METHODS, REF_REQUIRED_METHODS, getRefLabel, getRefPlaceholder } from "../types";

interface PaymentSectionProps {
  paymentMethod: string;
  setPaymentMethod: (m: string) => void;
  referenceNumber: string;
  setReferenceNumber: (v: string) => void;
  cashReceived: string;
  setCashReceived: (v: string) => void;
  cashReceivedUsd: string;
  setCashReceivedUsd: (v: string) => void;
  isCredit: boolean;
  setIsCredit: (v: boolean) => void;
  creditClientId: string;
  setCreditClientId: (v: string) => void;
  creditClientName: string;
  creditClientDebt: number;
  creditDays: number;
  setCreditDays: (v: number) => void;
  clients: ClientData[];
  mixedPayments: MixedEntry[];
  updateMixedEntry: (i: number, f: keyof MixedEntry, v: string | number) => void;
  addMixedEntry: () => void;
  removeMixedEntry: (i: number) => void;
  isMixedValid: boolean;
  mixedTotalBs: number;
  mixedRemaining: number;
  mixedRemainingUsd: number;
  enableDiscount: boolean;
  discount: number | string;
  setDiscount: (v: number) => void;
  maxDiscountPct: number;
  subtotal: number;
  canSaleNotes: boolean;
  notes: string;
  setNotes: (v: string) => void;
  bcvRate: number;
  total: number;
  totalBs: number;
  taxAmount: number;
  taxRate: number;
  taxMode?: string;
  effectiveDiscount: number;
  isUsdMethod: boolean;
  vuelto: number;
  vueltoUsd: number;
  currency: string;
  cashInputRef: React.RefObject<HTMLInputElement | null>;
  cashUsdInputRef: React.RefObject<HTMLInputElement | null>;
  onCompleteSale: () => void;
  cartLength: number;
}

// ── Payment method button config ──
const PAYMENT_METHODS: { value: string; label: string; shortLabel: string; icon: React.ReactNode; color: string }[] = [
  { value: "efectivo", label: "Efectivo (Bs)", shortLabel: "Bs", icon: <Banknote className="w-3.5 h-3.5" />, color: "bg-green-600 hover:bg-green-700 shadow-green-600/20 text-white" },
  { value: "efectivo-usd", label: "Efectivo ($)", shortLabel: "$", icon: <DollarSign className="w-3.5 h-3.5" />, color: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 text-white" },
  { value: "cashea", label: "Cashea", shortLabel: "Cashea", icon: <Landmark className="w-3.5 h-3.5" />, color: "bg-teal-600 hover:bg-teal-700 shadow-teal-600/20 text-white" },
  { value: "transferencia", label: "Transferencia", shortLabel: "Transf", icon: <Building className="w-3.5 h-3.5" />, color: "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 text-white" },
  { value: "pago-movil", label: "Pago Movil", shortLabel: "PMovil", icon: <Smartphone className="w-3.5 h-3.5" />, color: "bg-violet-600 hover:bg-violet-700 shadow-violet-600/20 text-white" },
  { value: "punto-de-venta", label: "Punto de Venta", shortLabel: "POS", icon: <CreditCard className="w-3.5 h-3.5" />, color: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 text-white" },
  { value: "zelle", label: "Zelle ($)", shortLabel: "Zelle", icon: <Landmark className="w-3.5 h-3.5" />, color: "bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/20 text-white" },
  { value: "usdt", label: "USDT ($)", shortLabel: "USDT", icon: <QrCode className="w-3.5 h-3.5" />, color: "bg-orange-600 hover:bg-orange-700 shadow-orange-600/20 text-white" },
  { value: "mixto", label: "Mixto", shortLabel: "Mixto", icon: <ArrowLeftRight className="w-3.5 h-3.5" />, color: "bg-pink-600 hover:bg-pink-700 shadow-pink-600/20 text-white" },
];

export function PaymentSection({
  paymentMethod, setPaymentMethod, referenceNumber, setReferenceNumber,
  cashReceived, setCashReceived, cashReceivedUsd, setCashReceivedUsd,
  isCredit, setIsCredit, creditClientId, setCreditClientId,
  creditClientName, creditClientDebt, creditDays, setCreditDays, clients,
  mixedPayments, updateMixedEntry, addMixedEntry, removeMixedEntry,
  isMixedValid, mixedTotalBs, mixedRemaining, mixedRemainingUsd,
  enableDiscount, discount, setDiscount, maxDiscountPct, subtotal,
  canSaleNotes, notes, setNotes, bcvRate,
  total, totalBs, taxAmount, taxRate, taxMode, effectiveDiscount,
  isUsdMethod, vuelto, vueltoUsd, currency,
  cashInputRef, cashUsdInputRef, onCompleteSale, cartLength,
}: PaymentSectionProps) {
  const showRefField = REF_REQUIRED_METHODS.includes(paymentMethod as any);

  return (
    <div className="space-y-3">
      {/* Payment method buttons */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Metodo de Pago</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => { setPaymentMethod(m.value); setReferenceNumber(""); }}
              className={`
                flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-[11px] font-bold
                transition-all duration-150 active:scale-[0.96] shadow-sm
                ${paymentMethod === m.value
                  ? m.color + ' ring-2 ring-offset-1 ring-current/30 scale-[1.02]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }
              `}
            >
              {m.icon}
              <span className="truncate">{m.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Vuelto efectivo Bs */}
      {paymentMethod === "efectivo" && !isCredit && cartLength > 0 && (
        <div className="space-y-1">
          <Label className="text-sm font-medium">Efectivo Recibido (Bs)</Label>
          <Input ref={cashInputRef} type="number" min="0" step="0.01" value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)} placeholder="Monto recibido del cliente" className="h-11 text-lg font-bold" />
          {cashReceived && (
            <div className={`p-3 rounded-lg border-2 text-center ${vuelto >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
              {vuelto >= 0
                ? <p className="text-xl font-bold text-green-700">Vuelto: Bs {vuelto.toFixed(2)}</p>
                : <p className="text-base font-bold text-red-600">Falta: Bs {Math.abs(vuelto).toFixed(2)}</p>}
            </div>
          )}
        </div>
      )}

      {/* Vuelto efectivo USD */}
      {paymentMethod === "efectivo-usd" && !isCredit && cartLength > 0 && (
        <div className="space-y-1">
          <Label className="text-sm font-medium">Efectivo Recibido ($)</Label>
          <Input ref={cashUsdInputRef} type="number" min="0" step="0.01" value={cashReceivedUsd}
            onChange={(e) => setCashReceivedUsd(e.target.value)} placeholder="Monto recibido en dolares" className="h-11 text-lg font-bold" />
          <p className="text-xs text-muted-foreground">Equivalente en Bs: {(parseFloat(cashReceivedUsd || "0") * bcvRate).toFixed(2)}</p>
          {cashReceivedUsd && (
            <div className={`p-3 rounded-lg border-2 text-center ${vueltoUsd >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
              {vueltoUsd >= 0
                ? <p className="text-xl font-bold text-green-700">Vuelto: ${vueltoUsd.toFixed(2)}</p>
                : <p className="text-base font-bold text-red-600">Falta: ${Math.abs(vueltoUsd).toFixed(2)}</p>}
            </div>
          )}
        </div>
      )}

      {/* Reference field */}
      {showRefField && paymentMethod !== "mixto" && (
        <div>
          <Label className="text-sm font-medium">{getRefLabel(paymentMethod)} *</Label>
          <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder={getRefPlaceholder(paymentMethod)} className="h-10 text-base font-mono" />
        </div>
      )}

      {/* Mixed payment breakdown */}
      {paymentMethod === "mixto" && (
        <div className="space-y-2 p-3 border rounded-xl bg-blue-50/50">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold text-blue-800">Desglose de Pago Mixto</Label>
            <Badge variant={isMixedValid ? "default" : "destructive"} className="text-xs px-3 py-1">
              {isMixedValid ? "COMPLETO" : `FALTAN Bs ${mixedRemaining.toFixed(2)} ($ ${mixedRemainingUsd.toFixed(2)})`}
            </Badge>
          </div>
          {mixedPayments.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-1 p-2 bg-background rounded-lg border">
              <select value={entry.method} onChange={(e) => updateMixedEntry(idx, "method", e.target.value)}
                className="h-9 text-xs rounded-lg border px-2 flex-shrink-0 w-28">
                <option value="efectivo">Efectivo</option>
                <option value="efectivo-usd">Efectivo ($)</option>
                <option value="cashea">Cashea</option>
                <option value="transferencia">Transferencia</option>
                <option value="pago-movil">Pago Movil</option>
                <option value="punto-de-venta">Punto de Venta</option>
                <option value="zelle">Zelle ($)</option>
                <option value="usdt">USDT ($)</option>
              </select>
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {USD_METHODS.includes(entry.method as any) ? "$" : "Bs"}
                </span>
                <Input
                  type="number" min="0" step="0.01"
                  value={USD_METHODS.includes(entry.method as any) ? (entry.amountUsd || "") : (entry.amountBs || "")}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (USD_METHODS.includes(entry.method as any)) {
                      updateMixedEntry(idx, "amountUsd", val);
                      updateMixedEntry(idx, "amountBs", parseFloat((val * bcvRate).toFixed(2)));
                    } else {
                      updateMixedEntry(idx, "amountBs", val);
                      updateMixedEntry(idx, "amountUsd", parseFloat((val / bcvRate).toFixed(2)));
                    }
                  }}
                  placeholder="0.00" className="h-9 text-xs pl-8"
                />
              </div>
              {["transferencia", "pago-movil", "zelle", "usdt"].includes(entry.method) && (
                <Input value={entry.reference} onChange={(e) => updateMixedEntry(idx, "reference", e.target.value)}
                  placeholder={getRefPlaceholder(entry.method)} className="h-9 text-xs font-mono w-28 flex-shrink-0" />
              )}
              {mixedPayments.length > 2 && (
                <button onClick={() => removeMixedEntry(idx)} className="text-destructive hover:text-red-700 text-sm flex-shrink-0 px-1">X</button>
              )}
            </div>
          ))}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={addMixedEntry} className="h-7 text-xs">+ Agregar metodo</Button>
          </div>
          <div className="text-xs space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Total desglose:</span><span className={isMixedValid ? "text-green-700 font-bold" : "text-red-600 font-bold"}>Bs {mixedTotalBs.toFixed(2)}</span></div>
            {!isMixedValid && <p className="text-red-600">Restante: Bs {mixedRemaining.toFixed(2)} ($ {mixedRemainingUsd.toFixed(2)})</p>}
            <div className="flex justify-between"><span className="text-muted-foreground">Total venta:</span><span>Bs {totalBs.toFixed(2)}</span></div>
          </div>
        </div>
      )}

      {/* Discount */}
      {enableDiscount && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Descuento ($):</span>
          <Input type="number" min="0" step="0.01" max={subtotal * (maxDiscountPct / 100)}
            value={discount || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setDiscount(v > subtotal * maxDiscountPct / 100 ? subtotal * maxDiscountPct / 100 : v); }}
            className="h-10 text-base" />
        </div>
      )}

      {/* Notes */}
      {canSaleNotes && (
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" className="h-14 text-sm" />
      )}

      {/* Credit section */}
      <div className={`border-2 rounded-xl p-4 transition-all ${isCredit ? "border-amber-400 bg-amber-50 shadow-md" : "border-muted bg-muted/30"}`}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isCredit} onChange={(e) => { setIsCredit(e.target.checked); if (!e.target.checked) setCreditClientId(""); }}
            className="h-6 w-6 rounded border-primary" />
          <span className={`text-lg font-bold flex items-center gap-2 ${isCredit ? "text-amber-700" : ""}`}>VENTA A CREDITO</span>
          {isCredit && <span className="ml-auto px-3 py-1 bg-amber-200 text-amber-800 rounded-lg text-sm font-bold">ACTIVO</span>}
        </label>
        {isCredit && (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-yellow-600 font-medium">Se registrara como deuda del cliente. La venta NO genera cobro en caja.</p>
            <div className="flex gap-2">
              <select value={creditClientId} onChange={(e) => setCreditClientId(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Seleccionar Cliente...</option>
                {clients.filter((c) => !c.isFinalClient).map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.docType}-{c.docNumber}){c.creditBalance && c.creditBalance > 0 ? ` — DEBE $${c.creditBalance.toFixed(2)}` : ""}</option>
                ))}
              </select>
            </div>
            {creditClientId && (
              <div className={`p-3 rounded-lg border-2 text-base font-semibold ${creditClientDebt > 0 ? "bg-red-50 border-red-400 text-red-800" : "bg-yellow-50 border-yellow-300 text-yellow-800"}`}>
                Se registrara deuda a: <strong>{creditClientName}</strong>
                {creditClientDebt > 0 && <><br />Este cliente ya debe: <strong className="text-lg">${creditClientDebt.toFixed(2)} (Bs {(creditClientDebt * bcvRate).toFixed(2)})</strong></>}
              </div>
            )}
            {creditClientId && creditClientDebt > 0 && (
              <div className="p-3 rounded-lg border-2 text-base bg-red-100 border-red-500 text-red-900 font-black text-center">
                CLIENTE CON DEUDA PENDIENTE: ${creditClientDebt.toFixed(2)} — Bs {(creditClientDebt * bcvRate).toFixed(2)}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Label className="text-sm whitespace-nowrap">Plazo credito:</Label>
              <Input type="number" min="1" max="365" value={creditDays} onChange={(e) => setCreditDays(parseInt(e.target.value) || 30)}
                className="w-20 h-9 text-center text-sm" />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Summary totals */}
      <div className="space-y-2 text-lg">
        {isUsdMethod ? (
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-semibold">${subtotal.toFixed(2)}</span></div>
            {taxAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IVA ({taxRate}%{taxMode === "included" ? " incl." : ""}):</span><span>Bs {(taxAmount * bcvRate).toFixed(2)}</span></div>}
            {effectiveDiscount > 0 && <div className="flex justify-between text-destructive"><span>Descuento:</span><span>-${effectiveDiscount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-3xl font-black text-primary"><span>Total:</span><span>${total.toFixed(2)}</span></div>
            <div className="flex justify-between text-base text-muted-foreground"><span>Equivalente Bs:</span><span className="font-semibold">Bs {totalBs.toFixed(2)}</span></div>
            <div className="text-sm text-muted-foreground">Tasa: 1$ = {bcvRate.toFixed(2)} Bs</div>
          </>
        ) : (
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-semibold">Bs {(subtotal * bcvRate).toFixed(2)}</span></div>
            {taxAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IVA ({taxRate}%{taxMode === "included" ? " incl." : ""}):</span><span>Bs {(taxAmount * bcvRate).toFixed(2)}</span></div>}
            {effectiveDiscount > 0 && <div className="flex justify-between text-destructive"><span>Descuento:</span><span>-Bs {(effectiveDiscount * bcvRate).toFixed(2)}</span></div>}
            <div className="flex justify-between text-3xl font-black text-primary"><span>Total:</span><span>Bs {totalBs.toFixed(2)}</span></div>
            <div className="flex justify-between text-base text-muted-foreground"><span>Total USD:</span><span className="font-semibold">${total.toFixed(2)}</span></div>
            <div className="text-sm text-muted-foreground">Tasa: 1$ = {bcvRate.toFixed(2)} Bs</div>
          </>
        )}
      </div>

      <Button variant="gradient" className="w-full mt-2 text-xl py-6 font-black tracking-wide rounded-xl" size="xl" onClick={onCompleteSale} disabled={cartLength === 0}>
        {isCredit ? `Registrar Credito $${total.toFixed(2)}` : isUsdMethod ? `Cobrar $ ${total.toFixed(2)}` : `Cobrar Bs ${totalBs.toFixed(2)}`}
      </Button>
    </div>
  );
}
