"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  FileText,
  Loader2,
  PauseCircle,
  RotateCcw,
  ShoppingCart,
  Trash2,
  User,
  DollarSign,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HeldSale {
  id: string;
  number: string;
  clientName: string;
  totalUsd: number;
  totalBs: number;
  itemsCount: number;
  paymentMethod: string;
  notes: string;
  status: string;
  createdAt: string;
  data: any;
}

interface HeldSalesTabProps {
  bcvRate: number;
  currency: string;
  currentUser: {
    id: string;
    fullName: string;
    role: string;
    username: string;
  };
  onRecoverSale?: (heldSale: any) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns a human-readable "time ago" string in Spanish. */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "justo ahora";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? "hace 1 día" : `hace ${days} días`;
  }
  if (hours > 0) {
    return hours === 1 ? "hace 1 hora" : `hace ${hours} horas`;
  }
  if (minutes > 0) {
    return minutes === 1 ? "hace 1 minuto" : `hace ${minutes} minutos`;
  }
  return "hace unos segundos";
}

/** Formats a date string to a readable Spanish date/time. */
function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats a number as USD currency. */
function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Formats a number as Bs currency. */
function formatBs(amount: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "VED",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Returns a variant-compatible color for payment method badges. */
function paymentMethodStyle(method: string): string {
  const lower = method.toLowerCase();
  if (lower.includes("efectivo") || lower.includes("cash")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (lower.includes("punto") || lower.includes("tarjeta") || lower.includes("card")) {
    return "bg-violet-100 text-violet-800 border-violet-200";
  }
  if (lower.includes("transfer") || lower.includes("zelle") || lower.includes("pago movil")) {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }
  return "bg-slate-100 text-slate-800 border-slate-200";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HeldSalesTab({
  bcvRate,
  currency,
  currentUser,
  onRecoverSale,
}: HeldSalesTabProps) {
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  /* -------------------------------------------------------------- */
  /*  Fetch held sales                                                */
  /* -------------------------------------------------------------- */

  const fetchHeldSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/held-sales?status=espera");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Error al cargar facturas en espera");
      }
      const data = await res.json();
      // API may return the array directly or wrapped in an object
      const list: HeldSale[] = Array.isArray(data) ? data : data.heldSales ?? data.data ?? [];
      setHeldSales(list);
    } catch (err: any) {
      toast.error(err.message || "No se pudieron cargar las facturas en espera");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeldSales();
  }, [fetchHeldSales]);

  /* -------------------------------------------------------------- */
  /*  Recover a held sale                                             */
  /* -------------------------------------------------------------- */

  const handleRecover = async (sale: HeldSale) => {
    setRecoveringId(sale.id);
    try {
      const res = await authFetch("/api/held-sales", {
        method: "PUT",
        body: JSON.stringify({ id: sale.id, status: "recuperada" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Error al recuperar la factura");
      }

      // Notify parent so POS can restore the cart
      onRecoverSale?.(sale);

      // Remove from local list
      setHeldSales((prev) => prev.filter((s) => s.id !== sale.id));
      toast.success(`Factura #${sale.number} recuperada exitosamente`);
    } catch (err: any) {
      toast.error(err.message || "No se pudo recuperar la factura");
    } finally {
      setRecoveringId(null);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Cancel a held sale                                              */
  /* -------------------------------------------------------------- */

  const handleCancel = async (sale: HeldSale) => {
    const confirmed = window.confirm(
      `¿Está seguro de cancelar la factura #${sale.number} de ${sale.clientName || "cliente general"}?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setCancelingId(sale.id);
    try {
      const res = await authFetch("/api/held-sales", {
        method: "PUT",
        body: JSON.stringify({ id: sale.id, status: "cancelada" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Error al cancelar la factura");
      }

      setHeldSales((prev) => prev.filter((s) => s.id !== sale.id));
      toast.success(`Factura #${sale.number} cancelada`);
    } catch (err: any) {
      toast.error(err.message || "No se pudo cancelar la factura");
    } finally {
      setCancelingId(null);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Render                                                          */
  /* -------------------------------------------------------------- */

  return (
    <section className="flex flex-col gap-4" aria-label="Facturas en Espera">
      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PauseCircle className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">
            Facturas en Espera
          </h2>
          {!loading && heldSales.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 bg-blue-600 text-white hover:bg-blue-700"
            >
              {heldSales.length}
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchHeldSales}
          disabled={loading}
          className="gap-1.5 text-slate-600"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* ---------- Loading ---------- */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-500">Cargando facturas en espera…</p>
        </div>
      )}

      {/* ---------- Empty state ---------- */}
      {!loading && heldSales.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <Clock className="h-7 w-7 text-blue-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            No hay facturas en espera
          </p>
          <p className="text-xs text-slate-400">
            Las facturas que se pongan en pausa aparecerán aquí.
          </p>
        </div>
      )}

      {/* ---------- Card list ---------- */}
      {!loading && heldSales.length > 0 && (
        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
          {heldSales.map((sale) => {
            const isRecovering = recoveringId === sale.id;
            const isCanceling = cancelingId === sale.id;

            return (
              <Card
                key={sale.id}
                className="group transition-all duration-200 hover:shadow-md hover:border-blue-200"
              >
                <CardContent className="p-4">
                  {/* Top row: number + time ago */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold text-sm text-slate-800">
                        #{sale.number}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">
                        {timeAgo(sale.createdAt)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium px-2 py-0 ${paymentMethodStyle(sale.paymentMethod)}`}
                      >
                        {sale.paymentMethod}
                      </Badge>
                    </div>
                  </div>

                  {/* Client name */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-sm text-slate-700">
                      {sale.clientName || "Cliente General"}
                    </span>
                  </div>

                  {/* Date/time + items count */}
                  <div className="flex items-center gap-4 mb-2 text-xs text-slate-400">
                    <span>{formatDateTime(sale.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" />
                      <span>
                        {sale.itemsCount} {sale.itemsCount === 1 ? "ítem" : "ítems"}
                      </span>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-800">
                        {formatUsd(sale.totalUsd)}
                      </span>
                    </div>
                    {sale.totalBs > 0 && (
                      <span className="text-xs text-slate-500">
                        ≈ {formatBs(sale.totalBs)}
                      </span>
                    )}
                  </div>

                  {/* Notes */}
                  {sale.notes && (
                    <div className="flex items-start gap-1.5 mb-3 rounded-md bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                      <StickyNote className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {sale.notes}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      onClick={() => handleRecover(sale)}
                      disabled={isRecovering || isCanceling}
                      className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isRecovering ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      {isRecovering ? "Recuperando…" : "Recuperar"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancel(sale)}
                      disabled={isRecovering || isCanceling}
                      className="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      {isCanceling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {isCanceling ? "Cancelando…" : "Cancelar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
