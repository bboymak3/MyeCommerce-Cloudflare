"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

interface CashClosing {
  id: string;
  date: string;
  closingType: string;
  sellerName: string;
  sellerRole?: string;
  totalSalesUsd: number;
  totalSalesBs: number;
  totalReturnsUsd: number;
  totalReturnsBs: number;
  netTotalUsd: number;
  netTotalBs: number;
  salesCount: number;
  returnsCount: number;
  cashUsd: number;
  cashBs: number;
  cardUsd: number;
  cardBs: number;
  checkUsd: number;
  checkBs: number;
  transferUsd: number;
  transferBs: number;
  mobileUsd: number;
  mobileBs: number;
  efectivoUsdUsd: number;
  efectivoUsdBs: number;
  creditSalesUsd: number;
  creditSalesBs: number;
  creditSalesCount: number;
  casheaSalesUsd: number;
  casheaSalesBs: number;
  casheaSalesCount: number;
  zelleUsd: number;
  zelleBs: number;
  usdtUsd: number;
  usdtBs: number;
  breakdownJson: string;
  exchangeRate: number;
  observations: string;
  createdAt: string;
}

interface ReferenceDetail {
  saleId: string;
  date: string;
  paymentType: string;
  label: string;
  reference: string;
  totalBs: number;
  totalUsd: number;
  customerName: string;
  saleTime: string;
}

interface CashClosingTabProps {
  bcvRate: number;
  currency: string;
}

export default function CashClosingTab({ bcvRate, currency }: CashClosingTabProps) {
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState<CashClosing | null>(null);
  const [observations, setObservations] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [closingType, setClosingType] = useState<"pre" | "final">("pre");
  const [loading, setLoading] = useState(false);

  // Arqueo de caja
  const [countedCashBs, setCountedCashBs] = useState("");
  const [countedCashUsd, setCountedCashUsd] = useState("");
  const [arqueoPreview, setArqueoPreview] = useState<{cashBs: number; totalSalesBs: number} | null>(null);

  // Datos de detalle: ventas y referencias del cierre seleccionado
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReferenceData, setDetailReferenceData] = useState<{
    referenceDetails: ReferenceDetail[];
    transferTotal: number;
    mobileTotal: number;
    salesCount: number;
    roleBreakdown: { role: string; label: string; salesCount: number; totalUsd: number; totalBs: number }[];
    groups?: {
      efectivoFisico: { bs: number; usd: number; subtotalBs: number; subtotalUsd: number; efectivoBs: { bs: number; usd: number }; efectivoUsd: { bs: number; usd: number } };
      bsElectronicos: { bs: number; usd: number; puntoVenta: { bs: number; usd: number }; transferencia: { bs: number; usd: number }; pagoMovil: { bs: number; usd: number } };
      divisasDigitales: { bs: number; usd: number; zelle: { bs: number; usd: number }; usdt: { bs: number; usd: number } };
    } | null;
  } | null>(null);

  const loadClosings = useCallback(async () => {
    try {
      const res = await authFetch("/api/cash-closing?limit=50");
      if (!res.ok) {
        setClosings([]);
        return;
      }
      const data = await res.json();
      setClosings(Array.isArray(data) ? data : []);
    } catch {
      setClosings([]);
      toast.error("Error al cargar cierres de caja");
    }
  }, []);

  useEffect(() => {
    loadClosings();
  }, [loadClosings]);

  const today = new Date().toISOString().slice(0, 10);

  // Pre-cierres del dia de hoy
  const todayPreClosings = closings.filter(
    (c) => new Date(c.date).toISOString().slice(0, 10) === today && c.closingType === 'pre'
  );

  // Cierre final del dia de hoy
  const todayFinalClosing = closings.find(
    (c) => new Date(c.date).toISOString().slice(0, 10) === today && c.closingType === 'final'
  );

  // Totales acumulados de pre-cierres del dia
  const preClosingsTotal = todayPreClosings.reduce(
    (acc, c) => ({
      salesUsd: acc.salesUsd + c.totalSalesUsd,
      salesBs: acc.salesBs + c.totalSalesBs,
      returnsUsd: acc.returnsUsd + c.totalReturnsUsd,
      returnsBs: acc.returnsBs + c.totalReturnsBs,
      netUsd: acc.netUsd + c.netTotalUsd,
      netBs: acc.netBs + c.netTotalBs,
      salesCount: acc.salesCount + c.salesCount,
      efectivoUsdUsd: acc.efectivoUsdUsd + (c.efectivoUsdUsd || 0),
    }),
    { salesUsd: 0, salesBs: 0, returnsUsd: 0, returnsBs: 0, netUsd: 0, netBs: 0, salesCount: 0, efectivoUsdUsd: 0 }
  );

  const openConfirmClose = (type: "pre" | "final") => {
    if (type === 'final' && todayFinalClosing) {
      toast.error("Ya existe un cierre final para hoy. No se puede generar otro.");
      return;
    }
    setClosingType(type);
    setObservations("");
    setSellerName("");
    setCountedCashBs("");
    setCountedCashUsd("");
    setArqueoPreview(null);
    if (type === "final") {
      authFetch(`/api/cash-closing?preview=true&date=${today}`, {}).then(r => r.json()).then(data => setArqueoPreview(data)).catch(() => {});
    }
    setShowConfirmDialog(true);
  };

  const performClosing = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/cash-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          closingType,
          sellerName: sellerName.trim(),
          observations: observations.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(
        closingType === 'pre'
          ? `Pre-cierre #${todayPreClosings.length + 1} generado exitosamente`
          : "Cierre final del dia generado exitosamente"
      );
      setShowConfirmDialog(false);
      loadClosings();
    } catch (error: any) {
      toast.error(error.message || "Error al generar cierre");
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (closing: CashClosing) => {
    setSelectedClosing(closing);
    setDetailReferenceData(null);
    setCountedCashBs("");
    setCountedCashUsd("");
    setShowDetailDialog(true);
    setDetailLoading(true);

    // Cargar datos de ventas con referencias
    try {
      const res = await authFetch(`/api/cash-closing?closingId=${closing.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetailReferenceData({
        referenceDetails: data.referenceDetails || [],
        transferTotal: data.transferTotal || 0,
        mobileTotal: data.mobileTotal || 0,
        salesCount: data.salesCount || 0,
        roleBreakdown: data.roleBreakdown || [],
        groups: data.groups || null,
      });
    } catch (error: any) {
      toast.error("Error al cargar detalle de ventas");
    } finally {
      setDetailLoading(false);
    }
  };

  // ===== IMPRIMIR DETALLE DEL CIERRE =====
  const printClosingDetail = () => {
    if (!selectedClosing || !detailReferenceData) return;

    const c = selectedClosing;
    const refData = detailReferenceData;
    const isPre = c.closingType === 'pre';
    const title = isPre ? `Pre-Cierre de Caja` : `Cierre Final del Dia`;
    const dateStr = new Date(c.date).toLocaleDateString("es-VE", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    const now = new Date().toLocaleString("es-VE");

    // Reference rows - separated by currency
    const bsRefs = refData.referenceDetails.filter(r => r.paymentType === 'Transferencia' || r.paymentType === 'Pago Movil');
    const usdRefs = refData.referenceDetails.filter(r => r.paymentType === 'Zelle' || r.paymentType === 'USDT');
    const bsTotal = bsRefs.reduce((s, r) => s + r.totalBs, 0);
    const bsTotalUsd = bsRefs.reduce((s, r) => s + r.totalUsd, 0);
    const usdTotal = usdRefs.reduce((s, r) => s + r.totalUsd, 0);
    const usdTotalBs = usdRefs.reduce((s, r) => s + r.totalBs, 0);

    const bsRefRows = bsRefs.map((r) =>
      `<tr>
        <td>${r.saleTime}</td>
        <td>${r.customerName}</td>
        <td><strong>${r.paymentType}</strong></td>
        <td class="ref">${r.reference}</td>
        <td class="amount">Bs ${r.totalBs.toFixed(2)}</td>
        <td class="amount">$ ${r.totalUsd.toFixed(2)}</td>
      </tr>`
    ).join('');

    const usdRefRows = usdRefs.map((r) =>
      `<tr>
        <td>${r.saleTime}</td>
        <td>${r.customerName}</td>
        <td><strong>${r.paymentType}</strong></td>
        <td class="ref">${r.reference}</td>
        <td class="amount">Bs ${r.totalBs.toFixed(2)}</td>
        <td class="amount">$ ${r.totalUsd.toFixed(2)}</td>
      </tr>`
    ).join('');

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) { toast.error('No se pudo abrir ventana de impresion'); return; }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 15px; color: #333; }
        .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .header h1 { font-size: 18px; margin-bottom: 4px; }
        .header .sub { font-size: 11px; color: #666; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; font-size: 11px; }
        .info-grid .item { padding: 4px 8px; background: #f9f9f9; border-radius: 4px; }
        .info-grid .item .label { color: #888; font-size: 9px; text-transform: uppercase; }
        .info-grid .item .value { font-weight: 600; }
        .summary { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 15px; }
        .summary .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px; text-align: center; }
        .summary .card .label { font-size: 9px; color: #888; text-transform: uppercase; }
        .summary .card .value { font-size: 16px; font-weight: bold; margin-top: 2px; }
        h2 { font-size: 14px; margin: 12px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
        th { background: #f5f5f5; text-align: left; padding: 6px 4px; border-bottom: 1px solid #ddd; font-size: 10px; text-transform: uppercase; }
        td { padding: 5px 4px; border-bottom: 1px solid #eee; }
        td.ref { font-family: monospace; font-size: 10px; letter-spacing: 0.5px; }
        td.amount { text-align: right; font-weight: 600; }
        .totals-row td { font-weight: bold; background: #f0f9ff; }
        .footer { text-align: center; margin-top: 15px; font-size: 9px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
        @media print { body { padding: 5px; } }
      </style></head><body>
      <div class="header">
        <h1>${title}</h1>
        <div class="sub">${dateStr} | Generado: ${now}</div>
      </div>

      <div class="info-grid">
        <div class="item"><div class="label">Vendedor</div><div class="value">${c.sellerName || "No especificado"}</div></div>
        <div class="item"><div class="label">Creado</div><div class="value">${new Date(c.createdAt).toLocaleString("es-VE")}</div></div>
        <div class="item"><div class="label">Tasa de Cambio</div><div class="value">1 USD = ${c.exchangeRate.toFixed(2)} Bs</div></div>
        <div class="item"><div class="label">Tipo</div><div class="value">${isPre ? 'PRE-CIERRE' : 'CIERRE FINAL'}</div></div>
        <div class="item"><div class="label">Rol del Vendedor</div><div class="value">${c.sellerRole ? (c.sellerRole === 'admin' ? 'Administrador' : c.sellerRole === 'vendedor' ? 'Vendedor' : 'Cajero') : "No especificado"}</div></div>
      </div>

      <div class="summary">
        <div class="card"><div class="label">Ventas ($)</div><div class="value" style="color:#16a34a">$ ${c.totalSalesUsd.toFixed(2)}</div></div>
        <div class="card"><div class="label">Ventas (Bs)</div><div class="value" style="color:#16a34a">Bs ${c.totalSalesBs.toFixed(2)}</div></div>
        <div class="card"><div class="label">Devoluciones</div><div class="value" style="color:#dc2626">-$ ${c.totalReturnsUsd.toFixed(2)}</div></div>
        <div class="card"><div class="label">Neto</div><div class="value">$ ${c.netTotalUsd.toFixed(2)}<br><span style="font-size:12px">Bs ${c.netTotalBs.toFixed(2)}</span></div></div>
      </div>

      <h2>Desglose por Metodo de Pago</h2>
      <table>
        <thead><tr><th>Metodo</th><th>Total $</th><th>Total Bs</th></tr></thead>
        <tbody>
          ${c.cashBs > 0 ? `<tr><td>Efectivo</td><td>$ ${c.cashUsd.toFixed(2)}</td><td>Bs ${c.cashBs.toFixed(2)}</td></tr>` : ''}
          ${(c.efectivoUsdUsd || 0) > 0 ? `<tr><td>Efectivo ($)</td><td>$ ${(c.efectivoUsdUsd || 0).toFixed(2)}</td><td>Bs ${(c.efectivoUsdBs || 0).toFixed(2)}</td></tr>` : ''}
          ${c.checkBs > 0 ? `<tr><td>Cheque</td><td>$ ${c.checkUsd.toFixed(2)}</td><td>Bs ${c.checkBs.toFixed(2)}</td></tr>` : ''}
          ${c.transferBs > 0 ? `<tr><td>Transferencia</td><td>$ ${c.transferUsd.toFixed(2)}</td><td>Bs ${c.transferBs.toFixed(2)}</td></tr>` : ''}
          ${c.mobileBs > 0 ? `<tr><td>Pago Movil</td><td>$ ${c.mobileUsd.toFixed(2)}</td><td>Bs ${c.mobileBs.toFixed(2)}</td></tr>` : ''}
          ${c.cardBs > 0 ? `<tr><td>Punto de Venta</td><td>$ ${c.cardUsd.toFixed(2)}</td><td>Bs ${c.cardBs.toFixed(2)}</td></tr>` : ''}
          ${c.zelleBs > 0 ? `<tr><td>Zelle ($)</td><td style="text-align:right">$ ${c.zelleUsd.toFixed(2)}</td><td style="text-align:right">Bs ${c.zelleBs.toFixed(2)}</td></tr>` : ''}
          ${c.usdtBs > 0 ? `<tr><td>USDT ($)</td><td style="text-align:right">$ ${c.usdtUsd.toFixed(2)}</td><td style="text-align:right">Bs ${c.usdtBs.toFixed(2)}</td></tr>` : ''}
          ${c.creditSalesBs > 0 ? `<tr><td>Crédito</td><td>$ ${c.creditSalesUsd.toFixed(2)}</td><td>Bs ${c.creditSalesBs.toFixed(2)}</td></tr>` : ''}
          ${c.casheaSalesBs > 0 ? `<tr><td>Cashea</td><td>$ ${c.casheaSalesUsd.toFixed(2)}</td><td>Bs ${c.casheaSalesBs.toFixed(2)}</td></tr>` : ''}
          <tr class="totals-row"><td>TOTAL</td><td>$ ${c.totalSalesUsd.toFixed(2)}</td><td>Bs ${c.totalSalesBs.toFixed(2)}</td></tr>
        </tbody>
      </table>

      <div style="margin-top:12px;border:1px solid #ccc;border-radius:6px;padding:8px;font-size:11px">
        <div style="font-weight:bold;margin-bottom:6px">DESGLOSE DE INGRESOS POR CANAL</div>
        <div style="border-left:3px solid #22c55e;padding-left:6px;margin-bottom:4px">
          <div style="font-weight:bold;color:#15803d">EFECTIVO FISICO Bs</div>
          <div>Bs ${c.cashBs.toFixed(2)} ($ ${c.cashUsd.toFixed(2)})</div>
        </div>
        ${(c.efectivoUsdUsd || 0) > 0 ? `
        <div style="border-left:3px solid #10b981;padding-left:6px;margin-bottom:4px">
          <div style="font-weight:bold;color:#059669">EFECTIVO FISICO $</div>
          <div>$ ${(c.efectivoUsdUsd || 0).toFixed(2)} (Bs ${(c.efectivoUsdBs || 0).toFixed(2)})</div>
        </div>` : ''}
        <div style="border-left:3px solid #3b82f6;padding-left:6px;margin-bottom:4px;background:#eff6ff;border-radius:0 4px 4px 0">
          <div style="font-weight:bold;color:#1d4ed8">Bs ELECTRONICOS (Punto Venta + Transferencia + Pago Movil)</div>
          <div>Pto.Venta: Bs ${(c.cardBs || 0).toFixed(2)} | Transf: Bs ${(c.transferBs || 0).toFixed(2)} | PM: Bs ${(c.mobileBs || 0).toFixed(2)}</div>
          <div style="font-weight:bold">Subtotal: Bs ${((c.cardBs || 0) + (c.transferBs || 0) + (c.mobileBs || 0)).toFixed(2)}</div>
        </div>
        <div style="border-left:3px solid #a855f7;padding-left:6px;margin-bottom:4px;background:#faf5ff;border-radius:0 4px 4px 0">
          <div style="font-weight:bold;color:#7e22ce">DIVISAS DIGITALES (Zelle + USDT)</div>
          <div>Zelle: $ ${(c.zelleUsd || 0).toFixed(2)} | USDT: $ ${(c.usdtUsd || 0).toFixed(2)}</div>
          <div style="font-weight:bold">Subtotal: $ ${((c.zelleUsd || 0) + (c.usdtUsd || 0)).toFixed(2)}</div>
        </div>
        <div style="border-top:2px solid #000;margin-top:8px;padding-top:6px;font-size:12px">
          <div style="font-weight:bold;margin-bottom:4px;color:#92400e">TOTAL ENTRADAS (Resumen para Arqueo):</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span style="color:#059669">Dolares (USD electronico + Efectivo $):</span>
            <span style="font-weight:bold">$ ${((c.zelleUsd || 0) + (c.usdtUsd || 0) + (c.efectivoUsdUsd || 0)).toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#1d4ed8">Bolivares (Bs electronicos + Efectivo Bs):</span>
            <span style="font-weight:bold">Bs ${((c.cardBs || 0) + (c.transferBs || 0) + (c.mobileBs || 0) + c.cashBs).toFixed(2)}</span>
          </div>
        </div>
      </div>

      ${detailReferenceData.roleBreakdown.length > 0 ? `
      <h2>Desglose por Rol</h2>
      <table>
        <thead><tr><th>Rol</th><th>Ventas</th><th>Total $</th><th>Total Bs</th><th>%</th></tr></thead>
        <tbody>
          ${detailReferenceData.roleBreakdown.map((r) => {
            const rTotal = detailReferenceData.roleBreakdown.reduce((s, x) => s + x.totalBs, 0);
            const rPct = rTotal > 0 ? ((r.totalBs / rTotal) * 100).toFixed(1) : "0";
            return `<tr><td>${r.label}</td><td>${r.salesCount}</td><td>$ ${r.totalUsd.toFixed(2)}</td><td>Bs ${r.totalBs.toFixed(2)}</td><td>${rPct}%</td></tr>`;
          }).join('')}
        </tbody>
      </table>` : ''}

      ${bsRefRows.length > 0 ? `
      <h2>Detalle de Referencias - Bs Electrónicos</h2>
      <div style="border:1px solid #3b82f6;border-radius:6px;padding:8px;margin-bottom:8px;background:#eff6ff">
        <table>
          <thead><tr><th>Fecha/Hora</th><th>Cliente</th><th>Tipo</th><th>Referencia</th><th style="text-align:right">Monto (Bs)</th><th style="text-align:right">Monto ($)</th></tr></thead>
          <tbody>
            ${bsRefRows}
            <tr class="totals-row">
              <td colspan="4" style="color:#1d4ed8">Total Bs Electrónicos (${bsRefs.length} ops)</td>
              <td style="text-align:right">Bs ${bsTotal.toFixed(2)}</td>
              <td style="text-align:right">$ ${bsTotalUsd.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>` : ''}
      ${usdRefRows.length > 0 ? `
      <h2>Detalle de Referencias - Dólares Digitales</h2>
      <div style="border:1px solid #a855f7;border-radius:6px;padding:8px;margin-bottom:8px;background:#faf5ff">
        <table>
          <thead><tr><th>Fecha/Hora</th><th>Cliente</th><th>Tipo</th><th>Referencia</th><th style="text-align:right">Monto (Bs)</th><th style="text-align:right">Monto ($)</th></tr></thead>
          <tbody>
            ${usdRefRows}
            <tr class="totals-row">
              <td colspan="4" style="color:#7e22ce">Total Dólares Digitales (${usdRefs.length} ops)</td>
              <td style="text-align:right">Bs ${usdTotalBs.toFixed(2)}</td>
              <td style="text-align:right">$ ${usdTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>` : ''}

      ${c.observations ? `<h2>Observaciones</h2><p style="font-size:11px;padding:8px;background:#f9f9f9;border-radius:4px">${c.observations}</p>` : ''}

      <div class="footer">Generado por MyeCommerce POS v2.9.55</div>
      <script>window.onload=function(){window.print();window.close();}</script>
      </body></html>`);
    printWindow.document.close();
  };

  const formatPaymentRow = (label: string, usd: number, bs: number) => {
    if (usd === 0 && bs === 0) return null;
    return (
      <div key={label} className="flex justify-between text-sm py-1">
        <span>{label}</span>
        <div className="text-right">
          <span>${usd.toFixed(2)}</span>
          <span className="text-muted-foreground ml-2">Bs {bs.toFixed(2)}</span>
        </div>
      </div>
    );
  };

  const getBadgeColor = (type: string) => {
    if (type === 'pre') return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Cierre de Caja</h2>
          <p className="text-xs text-muted-foreground">
            Pre-cierres por vendedor y cierre final del dia
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openConfirmClose("pre")}>
            Pre-Cierre
          </Button>
          <Button size="sm" onClick={() => openConfirmClose("final")}
            disabled={!!todayFinalClosing}>
            Cierre Final del Dia {todayFinalClosing && "(Hecho)"}
          </Button>
        </div>
      </div>

      {/* ====== RESUMEN DEL DIA ====== */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-800">Hoy</Badge>
            Resumen del Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Pre-cierres del dia */}
          {todayPreClosings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-2">
                Pre-cierres realizados ({todayPreClosings.length})
              </p>
              <div className="space-y-2">
                {todayPreClosings.map((pc, idx) => (
                  <div key={pc.id} className="flex items-center justify-between p-2 rounded border bg-blue-50/50 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        Pre #{idx + 1}
                      </Badge>
                      {pc.sellerName && (
                        <span className="text-xs text-muted-foreground truncate">
                          {pc.sellerName}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(pc.createdAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-green-600 font-medium">${pc.netTotalUsd.toFixed(2)}</p>
                        <p className="text-xs text-green-700 font-medium">Bs {pc.netTotalBs.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{pc.salesCount} ventas</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(pc)} className="h-7 text-[10px]">
                        Ver
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between p-2 rounded bg-blue-100/50 text-xs font-medium">
                  <span>Total Pre-cierres:</span>
                  <span>${preClosingsTotal.netUsd.toFixed(2)} / Bs {preClosingsTotal.netBs.toFixed(2)} ({preClosingsTotal.salesCount} ventas)</span>
                </div>
              </div>
            </div>
          )}

          {/* Cierre final */}
          {todayFinalClosing && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2">Cierre Final del Dia</p>
              <div className="p-3 rounded border bg-green-50/50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600">
                      ${todayFinalClosing.totalSalesUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Ventas ($)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600">
                      Bs {todayFinalClosing.totalSalesBs.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Ventas (Bs)</p>
                  </div>
                  {(todayFinalClosing.creditSalesBs > 0 || todayFinalClosing.creditSalesCount > 0) && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-amber-600">
                      ${todayFinalClosing.creditSalesUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Crédito ($)</p>
                    <p className="text-sm font-bold text-amber-700">Bs {todayFinalClosing.creditSalesBs.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{todayFinalClosing.creditSalesCount} ventas</p>
                  </div>
                  )}
                  {(todayFinalClosing.casheaSalesBs > 0 || todayFinalClosing.casheaSalesCount > 0) && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-purple-600">
                      ${todayFinalClosing.casheaSalesUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Cashea ($)</p>
                    <p className="text-sm font-bold text-purple-700">Bs {todayFinalClosing.casheaSalesBs.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{todayFinalClosing.casheaSalesCount} ventas</p>
                  </div>
                  )}
                  <div className="text-center">
                    <p className="text-xl font-bold text-destructive">
                      -${todayFinalClosing.totalReturnsUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Devoluciones ($)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">
                      ${todayFinalClosing.netTotalUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Neto ($)</p>
                  </div>
                </div>
                <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{todayFinalClosing.salesCount} ventas</span>
                  <span>{todayFinalClosing.returnsCount} devoluciones</span>
                  <span>Tasa: {todayFinalClosing.exchangeRate.toFixed(2)} Bs/$</span>
                </div>
                <div className="text-center mt-2">
                  <Button variant="outline" size="sm" onClick={() => openDetail(todayFinalClosing)} className="text-xs">
                    Ver Detalle Completo
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!todayPreClosings.length && !todayFinalClosing && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                No se ha generado ningun cierre para hoy.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Use "Pre-Cierre" al cambiar de vendedor y "Cierre Final" al terminar el dia.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== HISTORIAL DE CIERRES ====== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Historial de Cierres</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Tipo</th>
                  <th className="text-left p-2 font-medium">Fecha</th>
                  <th className="text-left p-2 font-medium">Vendedor</th>
                  <th className="text-right p-2 font-medium">Neto (Bs)</th>
                  <th className="text-right p-2 font-medium">Neto ($)</th>
                  <th className="text-center p-2 font-medium">Vtas</th>
                  <th className="text-center p-2 font-medium">Acc.</th>
                </tr>
              </thead>
              <tbody>
                {closings.map((closing) => (
                  <tr key={closing.id} className="border-t hover:bg-muted/30">
                    <td className="p-2">
                      <Badge variant="outline" className={`text-[10px] ${getBadgeColor(closing.closingType)}`}>
                        {closing.closingType === 'pre' ? 'PRE-CIERRE' : 'CIERRE FINAL'}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs">
                      {new Date(closing.date).toLocaleDateString("es-VE", {
                        day: "2-digit", month: "2-digit",
                      })}
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {new Date(closing.createdAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="p-2 text-xs">{closing.sellerName || "-"}</td>
                    <td className="p-2 text-right font-bold">
                      Bs {closing.netTotalBs.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-medium">
                      {currency} {closing.netTotalUsd.toFixed(2)}
                    </td>
                    <td className="p-2 text-center">{closing.salesCount}</td>
                    <td className="p-2 text-center">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(closing)} className="h-7 text-xs">
                        Detalle
                      </Button>
                    </td>
                  </tr>
                ))}
                {closings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      No hay cierres de caja registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ====== DIALOGO CONFIRMAR CIERRE ====== */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {closingType === 'pre' ? `Pre-Cierre #${todayPreClosings.length + 1}` : 'Cierre Final del Dia'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {closingType === 'pre' ? (
              <div>
                <p className="text-sm">
                  Se generara un pre-cierre con las ventas realizadas desde{" "}
                  <strong>{todayPreClosings.length > 0 ? 'el ultimo pre-cierre' : 'el inicio del dia'}</strong> hasta ahora.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ideal para cuando hay cambio de vendedor y se necesita cuadrar caja.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm">
                  Se generara el cierre final con <strong>TODAS las ventas del dia</strong>{" "}
                  {todayPreClosings.length > 0 && `(incluyendo ${todayPreClosings.length} pre-cierre${todayPreClosings.length > 1 ? 's' : ''})`}.
                </p>
                {todayPreClosings.length > 0 && (
                  <div className="p-2 rounded bg-muted text-xs mt-2">
                    <p>Total pre-cierres: Bs {preClosingsTotal.netBs.toFixed(2)} ({preClosingsTotal.salesCount} ventas)</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-1">Nombre del Vendedor</p>
              <Input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Ej: Juan Perez"
                onKeyDown={(e: any) => e.key === "Enter" && performClosing()}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Observaciones (opcional)</p>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Notas sobre el cierre..."
                rows={2}
              />
            </div>

            {closingType === 'final' && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <p className="text-sm font-medium">Arqueo de Caja</p>
                <div>
                  <Label className="text-xs">Efectivo contado fisicamente en caja (Bs)</Label>
                  <Input type="number" min="0" step="0.01" value={countedCashBs}
                    onChange={(e) => setCountedCashBs(e.target.value)}
                    placeholder="Escriba el monto que conto en caja"
                    className="text-lg font-bold text-center" />
                </div>
                <div>
                  <Label className="text-xs">Efectivo contado fisicamente en caja ($)</Label>
                  <Input type="number" min="0" step="0.01" value={countedCashUsd}
                    onChange={(e) => setCountedCashUsd(e.target.value)}
                    placeholder="Escriba el monto en dolares que conto en caja"
                    className="text-lg font-bold text-center" />
                </div>
                {(countedCashBs || countedCashUsd) && (() => {
                  const countedBs = parseFloat(countedCashBs) || 0;
                  const countedUsdVal = parseFloat(countedCashUsd) || 0;
                  const expectedBs = arqueoPreview?.cashBs || todayFinalClosing?.cashBs || (todayPreClosings.length > 0 ? preClosingsTotal.salesBs : 0);
                  const expectedUsd = todayFinalClosing?.efectivoUsdUsd || (todayPreClosings.length > 0 ? preClosingsTotal.efectivoUsdUsd : 0);
                  const diffBs = countedBs - expectedBs;
                  const diffUsd = countedUsdVal - expectedUsd;
                  return (
                    <div className="space-y-2">
                      {countedCashBs && (
                        <div className={`p-2 rounded border text-center ${Math.abs(diffBs) < 0.01 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Efectivo Bs esperado:</span><span>Bs {expectedBs.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Efectivo Bs contado:</span><span>Bs {countedBs.toFixed(2)}</span>
                          </div>
                          <p className={`text-lg font-bold mt-1 ${Math.abs(diffBs) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                            {Math.abs(diffBs) < 0.01 ? 'Cuadra perfecto' :
                              diffBs > 0 ? `Sobrante: Bs ${diffBs.toFixed(2)}` :
                              `Faltante: Bs ${Math.abs(diffBs).toFixed(2)}`}
                          </p>
                        </div>
                      )}
                      {countedCashUsd && (
                        <div className={`p-2 rounded border text-center ${Math.abs(diffUsd) < 0.01 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Efectivo $ esperado:</span><span>${expectedUsd.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Efectivo $ contado:</span><span>${countedUsdVal.toFixed(2)}</span>
                          </div>
                          <p className={`text-lg font-bold mt-1 ${Math.abs(diffUsd) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                            {Math.abs(diffUsd) < 0.01 ? 'Cuadra perfecto' :
                              diffUsd > 0 ? `Sobrante: $ ${diffUsd.toFixed(2)}` :
                              `Faltante: $ ${Math.abs(diffUsd).toFixed(2)}`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowConfirmDialog(false); setArqueoPreview(null); }}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={performClosing} disabled={loading}>
                {loading
                  ? "Generando..."
                  : closingType === 'pre'
                    ? `Generar Pre-Cierre #${todayPreClosings.length + 1}`
                    : "Generar Cierre Final"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== DIALOGO DETALLE ====== */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Badge variant="outline" className={`text-xs mr-2 ${getBadgeColor(selectedClosing?.closingType || 'final')}`}>
                {selectedClosing?.closingType === 'pre' ? 'PRE-CIERRE' : 'CIERRE FINAL'}
              </Badge>
              Detalle del Cierre -{" "}
              {selectedClosing &&
                new Date(selectedClosing.date).toLocaleDateString("es-VE", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
            </DialogTitle>
          </DialogHeader>
          {selectedClosing && (
            <div className="space-y-4 text-sm">
              {/* Boton imprimir */}
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={printClosingDetail} disabled={detailLoading}>
                  &#128424; Imprimir Detalle
                </Button>
              </div>

              {/* Info del vendedor y hora */}
              <div className="p-2 rounded bg-muted text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendedor:</span>
                  <span className="font-medium">{selectedClosing.sellerName || "No especificado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creado:</span>
                  <span>{new Date(selectedClosing.createdAt).toLocaleString("es-VE")}</span>
                </div>
              </div>

              {/* Resumen General */}
              <div className="p-3 rounded border space-y-2">
                <h4 className="font-semibold">Resumen General</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Ventas Totales</p>
                    <p className="font-bold text-green-600">
                      ${selectedClosing.totalSalesUsd.toFixed(2)}
                    </p>
                    <p className="text-xs text-green-600">
                      Bs {selectedClosing.totalSalesBs.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Devoluciones</p>
                    <p className="font-bold text-destructive">
                      -${selectedClosing.totalReturnsUsd.toFixed(2)}
                    </p>
                    <p className="text-xs text-destructive">
                      -Bs {selectedClosing.totalReturnsBs.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Neto</p>
                    <p className="font-bold text-lg">
                      ${selectedClosing.netTotalUsd.toFixed(2)}
                    </p>
                    <p className="text-xs">
                      Bs {selectedClosing.netTotalBs.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transacciones</p>
                    <p>{selectedClosing.salesCount} ventas</p>
                    <p>{selectedClosing.returnsCount} devoluciones</p>
                  </div>
                </div>
              </div>

              {/* Desglose contado vs crédito vs cashea */}
              {(selectedClosing.creditSalesBs > 0 || selectedClosing.creditSalesCount > 0 || selectedClosing.casheaSalesBs > 0 || selectedClosing.casheaSalesCount > 0) && (
              <div className="p-3 rounded border border-amber-200 bg-amber-50/30 space-y-2">
                <h4 className="font-semibold text-amber-800">Contado / Crédito / Cashea</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded bg-green-50 border border-green-200 text-center">
                    <p className="text-[10px] text-muted-foreground">Ventas al Contado</p>
                    <p className="text-sm font-bold text-green-700">Bs {(selectedClosing.totalSalesBs - selectedClosing.creditSalesBs).toFixed(2)}</p>
                    <p className="text-xs font-semibold text-green-600">${(selectedClosing.totalSalesUsd - selectedClosing.creditSalesUsd).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedClosing.salesCount - selectedClosing.creditSalesCount - selectedClosing.casheaSalesCount} ventas</p>
                  </div>
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-center">
                    <p className="text-[10px] text-muted-foreground">Ventas a Crédito</p>
                    <p className="text-sm font-bold text-amber-700">Bs {selectedClosing.creditSalesBs.toFixed(2)}</p>
                    <p className="text-xs font-semibold text-amber-600">${selectedClosing.creditSalesUsd.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedClosing.creditSalesCount} ventas</p>
                  </div>
                  <div className="p-2 rounded bg-purple-50 border border-purple-200 text-center">
                    <p className="text-[10px] text-muted-foreground">Ventas Cashea</p>
                    <p className="text-sm font-bold text-purple-700">Bs {selectedClosing.casheaSalesBs.toFixed(2)}</p>
                    <p className="text-xs font-semibold text-purple-600">${selectedClosing.casheaSalesUsd.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedClosing.casheaSalesCount} ventas</p>
                  </div>
                </div>
              </div>
              )}

              {/* Desglose por rol */}
              {detailReferenceData && detailReferenceData.roleBreakdown && detailReferenceData.roleBreakdown.length > 0 && (
                <div className="p-3 rounded border space-y-2">
                  <h4 className="font-semibold">Desglose por Rol</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {detailReferenceData.roleBreakdown.map((role) => {
                      const totalAllBs = detailReferenceData.roleBreakdown.reduce((s, r) => s + r.totalBs, 0);
                      const pct = totalAllBs > 0 ? ((role.totalBs / totalAllBs) * 100).toFixed(1) : "0";
                      const colorMap: Record<string, string> = { admin: "#8b5cf6", vendedor: "#16a34a", cajero: "#2563eb" };
                      const color = colorMap[role.role] || "#6b7280";
                      return (
                        <div key={role.role} className="p-2 rounded border text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium">{role.label}</span>
                          </div>
                          <p className="text-lg font-bold text-green-600">Bs {role.totalBs.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">{role.salesCount} ventas | ${role.totalUsd.toFixed(2)} | {pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!detailLoading && detailReferenceData && (!detailReferenceData.roleBreakdown || detailReferenceData.roleBreakdown.length === 0) && (
                <div className="p-3 rounded border text-center text-muted-foreground">
                  <p className="text-xs">No hay desglose por rol en este cierre.</p>
                </div>
              )}

              {/* Desglose por metodo de pago */}
              <div className="p-3 rounded border space-y-1">
                <h4 className="font-semibold mb-2">Desglose por Metodo de Pago</h4>
                {formatPaymentRow("Efectivo", selectedClosing.cashUsd, selectedClosing.cashBs)}
                {formatPaymentRow("Punto de Venta", selectedClosing.cardUsd, selectedClosing.cardBs)}
                {formatPaymentRow("Cheque", selectedClosing.checkUsd, selectedClosing.checkBs)}
                {formatPaymentRow("Transferencia", selectedClosing.transferUsd, selectedClosing.transferBs)}
                {formatPaymentRow("Pago Movil", selectedClosing.mobileUsd, selectedClosing.mobileBs)}
                {formatPaymentRow("Zelle ($)", selectedClosing.zelleUsd, selectedClosing.zelleBs)}
                {formatPaymentRow("USDT ($)", selectedClosing.usdtUsd, selectedClosing.usdtBs)}
              </div>

              {/* Resumen Agrupado de Ingresos */}
              <div className="mt-4 p-3 border rounded-lg space-y-2 bg-gradient-to-r from-slate-50 to-white">
                <h4 className="font-bold text-sm">Desglose de Ingresos por Canal</h4>
                {(() => {
                  const g = detailReferenceData?.groups;
                  const rate = selectedClosing.exchangeRate || 36.5;
                  const effBs = g?.efectivoFisico?.efectivoBs || { bs: selectedClosing.cashBs, usd: selectedClosing.cashUsd };
                  const effUsd = g?.efectivoFisico?.efectivoUsd || { bs: 0, usd: 0 };
                  const bse = g?.bsElectronicos || {
                    bs: (selectedClosing.cardBs || 0) + (selectedClosing.transferBs || 0) + (selectedClosing.mobileBs || 0),
                    usd: (selectedClosing.cardUsd || 0) + (selectedClosing.transferUsd || 0) + (selectedClosing.mobileUsd || 0),
                    puntoVenta: { bs: selectedClosing.cardBs || 0, usd: selectedClosing.cardUsd || 0 },
                    transferencia: { bs: selectedClosing.transferBs || 0, usd: selectedClosing.transferUsd || 0 },
                    pagoMovil: { bs: selectedClosing.mobileBs || 0, usd: selectedClosing.mobileUsd || 0 },
                  };
                  const dd = g?.divisasDigitales || {
                    bs: (selectedClosing.zelleBs || 0) + (selectedClosing.usdtBs || 0),
                    usd: (selectedClosing.zelleUsd || 0) + (selectedClosing.usdtUsd || 0),
                    zelle: { bs: selectedClosing.zelleBs || 0, usd: selectedClosing.zelleUsd || 0 },
                    usdt: { bs: selectedClosing.usdtBs || 0, usd: selectedClosing.usdtUsd || 0 },
                  };
                  return (<>
                    {/* EFECTIVO FÍSICO Bs */}
                    <div className="border-l-4 border-green-500 pl-2">
                      <div className="font-semibold text-xs text-green-700">🟢 EFECTIVO FÍSICO Bs</div>
                      <div className="text-xs text-muted-foreground">
                        Bs {effBs.bs.toFixed(2)} (${effBs.usd.toFixed(2)})
                      </div>
                    </div>
                    {/* EFECTIVO FÍSICO $ */}
                    {effUsd.usd > 0 && (
                      <div className="border-l-4 border-emerald-500 pl-2">
                        <div className="font-semibold text-xs text-emerald-700">🟢 EFECTIVO FÍSICO $</div>
                        <div className="text-xs text-muted-foreground">
                          ${effUsd.usd.toFixed(2)} (Bs {effUsd.bs.toFixed(2)})
                        </div>
                      </div>
                    )}
                    {/* Bs ELECTRÓNICOS */}
                    <div className="border-l-4 border-blue-500 pl-2 bg-blue-50 rounded-r">
                      <div className="font-semibold text-xs text-blue-700">🔵 Bs ELECTRÓNICOS</div>
                      <div className="text-xs">Pto.Venta: Bs {bse.puntoVenta.bs.toFixed(2)} | Transf: Bs {bse.transferencia.bs.toFixed(2)} | PM: Bs {bse.pagoMovil.bs.toFixed(2)}</div>
                      <div className="text-xs font-medium">Subtotal: Bs {bse.bs.toFixed(2)} (${bse.usd.toFixed(2)})</div>
                    </div>
                    {/* DIVISAS DIGITALES */}
                    <div className="border-l-4 border-purple-500 pl-2 bg-purple-50 rounded-r">
                      <div className="font-semibold text-xs text-purple-700">🟣 DIVISAS DIGITALES</div>
                      <div className="text-xs">Zelle: Bs {dd.zelle.bs.toFixed(2)} (${dd.zelle.usd.toFixed(2)}) | USDT: Bs {dd.usdt.bs.toFixed(2)} (${dd.usdt.usd.toFixed(2)})</div>
                      <div className="text-xs font-medium">Subtotal: Bs {dd.bs.toFixed(2)} (${dd.usd.toFixed(2)})</div>
                    </div>
                    {/* TOTAL - EXPLICITO PARA ARQUEO */}
                    <div className="border-2 border-amber-500 rounded-lg p-2 bg-amber-50/80 space-y-1.5 mt-2">
                      <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider">Resumen para Arqueo</p>
                      {/* DOLARES */}
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-green-800 uppercase tracking-wide">Dolares (USD electronico + Efectivo $):</p>
                        {effUsd.usd > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Efectivo $ (contar):</span><span className="text-right font-semibold">${effUsd.usd.toFixed(2)}</span></div>}
                        {dd.zelle.usd > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Zelle (ver app):</span><span className="text-right font-semibold">${dd.zelle.usd.toFixed(2)}</span></div>}
                        {dd.usdt.usd > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">USDT (ver wallet):</span><span className="text-right font-semibold">${dd.usdt.usd.toFixed(2)}</span></div>}
                        <div className="flex justify-between text-[10px] bg-green-100/60 rounded px-1.5 py-0.5">
                          <span className="font-black text-green-900">TOTAL USD:</span>
                          <span className="font-black text-green-900">${(dd.usd + effUsd.usd).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="border-t border-dashed border-amber-300" />
                      {/* BOLIVARES */}
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-blue-800 uppercase tracking-wide">Bolivares (Bs electronicos + Efectivo Bs):</p>
                        <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Efectivo Bs (contar):</span><span className="text-right font-semibold">Bs {effBs.bs.toFixed(2)}</span></div>
                        {bse.puntoVenta.bs > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Punto Venta (ver terminal):</span><span className="text-right font-semibold">Bs {bse.puntoVenta.bs.toFixed(2)}</span></div>}
                        {bse.transferencia.bs > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Transferencia (ver banco):</span><span className="text-right font-semibold">Bs {bse.transferencia.bs.toFixed(2)}</span></div>}
                        {bse.pagoMovil.bs > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Pago Movil (ver banco):</span><span className="text-right font-semibold">Bs {bse.pagoMovil.bs.toFixed(2)}</span></div>}
                        <div className="flex justify-between text-[10px] bg-blue-100/60 rounded px-1.5 py-0.5">
                          <span className="font-black text-blue-900">TOTAL BS:</span>
                          <span className="font-black text-blue-900">Bs {(bse.bs + effBs.bs).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </>);
                })()}
              </div>

              {/* ===== ARQUEO DE CAJA EN DETALLE ===== */}
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">&#128270; Arqueo de Caja</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Efectivo Bs contado</Label>
                    <Input type="number" min="0" step="0.01" value={countedCashBs}
                      onChange={(e) => setCountedCashBs(e.target.value)}
                      placeholder="0.00" className="text-base font-bold text-center" />
                  </div>
                  <div>
                    <Label className="text-xs">Efectivo $ contado</Label>
                    <Input type="number" min="0" step="0.01" value={countedCashUsd}
                      onChange={(e) => setCountedCashUsd(e.target.value)}
                      placeholder="0.00" className="text-base font-bold text-center" />
                  </div>
                </div>
                {(countedCashBs || countedCashUsd) && (() => {
                  const countedBsVal = parseFloat(countedCashBs) || 0;
                  const countedUsdVal = parseFloat(countedCashUsd) || 0;
                  const expectedBs = selectedClosing.cashBs || 0;
                  const expectedUsd = selectedClosing.efectivoUsdUsd || 0;
                  const diffBs = countedBsVal - expectedBs;
                  const diffUsd = countedUsdVal - expectedUsd;
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {countedCashBs && (
                        <div className={`p-2 rounded border text-center ${Math.abs(diffBs) < 0.01 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <p className="text-[10px] text-muted-foreground">Esperado: Bs {expectedBs.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">Contado: Bs {countedBsVal.toFixed(2)}</p>
                          <p className={`text-sm font-bold ${Math.abs(diffBs) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                            {Math.abs(diffBs) < 0.01 ? 'Cuadra' :
                              diffBs > 0 ? `Sobrante Bs ${diffBs.toFixed(2)}` :
                              `Faltante Bs ${Math.abs(diffBs).toFixed(2)}`}
                          </p>
                        </div>
                      )}
                      {countedCashUsd && (
                        <div className={`p-2 rounded border text-center ${Math.abs(diffUsd) < 0.01 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <p className="text-[10px] text-muted-foreground">Esperado: ${expectedUsd.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">Contado: ${countedUsdVal.toFixed(2)}</p>
                          <p className={`text-sm font-bold ${Math.abs(diffUsd) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                            {Math.abs(diffUsd) < 0.01 ? 'Cuadra' :
                              diffUsd > 0 ? `Sobrante $ ${diffUsd.toFixed(2)}` :
                              `Faltante $ ${Math.abs(diffUsd).toFixed(2)}`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ===== DESGLOSE DE REFERENCIAS ===== */}
              {detailLoading ? (
                <div className="p-3 rounded border text-center text-muted-foreground">
                  <p className="text-sm">Cargando detalle de ventas...</p>
                </div>
              ) : detailReferenceData && detailReferenceData.referenceDetails.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    &#128196; Detalle de Referencias
                  </h4>
                  {(() => {
                    const bsRefs = detailReferenceData.referenceDetails.filter(r => r.paymentType === 'Transferencia' || r.paymentType === 'Pago Movil');
                    const usdRefs = detailReferenceData.referenceDetails.filter(r => r.paymentType === 'Zelle' || r.paymentType === 'USDT');
                    const bsTotal = bsRefs.reduce((s, r) => s + r.totalBs, 0);
                    const bsTotalUsd = bsRefs.reduce((s, r) => s + r.totalUsd, 0);
                    const usdTotal = usdRefs.reduce((s, r) => s + r.totalUsd, 0);
                    const usdTotalBs = usdRefs.reduce((s, r) => s + r.totalBs, 0);
                    return (<>
                      {/* Bs ELECTRÓNICOS */}
                      {bsRefs.length > 0 && (
                        <div className="p-3 rounded border border-blue-500 bg-blue-50 space-y-2">
                          <h5 className="font-bold text-xs text-blue-800 flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
                            Bs Electrónicos — Transferencia + Pago Movil ({bsRefs.length} ops)
                          </h5>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-1.5 rounded bg-blue-100/50 text-center">
                              <p className="text-[10px] text-muted-foreground">Transferencias</p>
                              <p className="text-xs font-bold text-blue-700">{bsRefs.filter(r => r.paymentType === 'Transferencia').length} ops</p>
                              <p className="text-[11px] font-semibold text-blue-600">Bs {bsRefs.filter(r => r.paymentType === 'Transferencia').reduce((s, r) => s + r.totalBs, 0).toFixed(2)}</p>
                            </div>
                            <div className="p-1.5 rounded bg-blue-100/50 text-center">
                              <p className="text-[10px] text-muted-foreground">Pago Movil</p>
                              <p className="text-xs font-bold text-blue-700">{bsRefs.filter(r => r.paymentType === 'Pago Movil').length} ops</p>
                              <p className="text-[11px] font-semibold text-blue-600">Bs {bsRefs.filter(r => r.paymentType === 'Pago Movil').reduce((s, r) => s + r.totalBs, 0).toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="overflow-x-auto max-h-36 overflow-y-auto">
                            <table className="w-full text-[11px]">
                              <thead className="bg-blue-100/70 sticky top-0">
                                <tr>
                                  <th className="text-left p-1.5 font-medium">Hora</th>
                                  <th className="text-left p-1.5 font-medium">Cliente</th>
                                  <th className="text-left p-1.5 font-medium">Tipo</th>
                                  <th className="text-left p-1.5 font-medium">Referencia</th>
                                  <th className="text-right p-1.5 font-medium">Monto (Bs)</th>
                                  <th className="text-right p-1.5 font-medium">Monto ($)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bsRefs.map((ref, idx) => (
                                  <tr key={`bs-${ref.saleId}-${idx}`} className="border-t hover:bg-blue-100/50">
                                    <td className="p-1.5 text-[10px]">{ref.saleTime}</td>
                                    <td className="p-1.5 text-[10px] truncate max-w-[80px]">{ref.customerName}</td>
                                    <td className="p-1.5">
                                      <Badge variant="outline" className={`text-[8px] ${ref.paymentType === 'Transferencia' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-blue-200 text-blue-800 border-blue-300'}`}>
                                        {ref.paymentType === 'Transferencia' ? 'Transf.' : 'P.Movil'}
                                      </Badge>
                                    </td>
                                    <td className="p-1.5 font-mono text-[10px] font-semibold tracking-wide">{ref.reference}</td>
                                    <td className="p-1.5 text-right font-bold text-blue-700">Bs {ref.totalBs.toFixed(2)}</td>
                                    <td className="p-1.5 text-right font-medium">{currency} {ref.totalUsd.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-blue-400 bg-blue-200/40 font-bold">
                                  <td colSpan={4} className="p-1.5 text-right text-[10px]">Total Bs Electrónicos ({bsRefs.length} ops)</td>
                                  <td className="p-1.5 text-right text-[10px] text-blue-800">Bs {bsTotal.toFixed(2)}</td>
                                  <td className="p-1.5 text-right text-[10px]">{currency} {bsTotalUsd.toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                      {/* DÓLARES DIGITALES */}
                      {usdRefs.length > 0 && (
                        <div className="p-3 rounded border border-purple-500 bg-purple-50 space-y-2">
                          <h5 className="font-bold text-xs text-purple-800 flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
                            Dólares Digitales — Zelle + USDT ({usdRefs.length} ops)
                          </h5>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-1.5 rounded bg-purple-100/50 text-center">
                              <p className="text-[10px] text-muted-foreground">Zelle</p>
                              <p className="text-xs font-bold text-purple-700">{usdRefs.filter(r => r.paymentType === 'Zelle').length} ops</p>
                              <p className="text-[11px] font-semibold text-purple-600">${usdRefs.filter(r => r.paymentType === 'Zelle').reduce((s, r) => s + r.totalUsd, 0).toFixed(2)}</p>
                            </div>
                            <div className="p-1.5 rounded bg-purple-100/50 text-center">
                              <p className="text-[10px] text-muted-foreground">USDT</p>
                              <p className="text-xs font-bold text-purple-700">{usdRefs.filter(r => r.paymentType === 'USDT').length} ops</p>
                              <p className="text-[11px] font-semibold text-purple-600">${usdRefs.filter(r => r.paymentType === 'USDT').reduce((s, r) => s + r.totalUsd, 0).toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="overflow-x-auto max-h-36 overflow-y-auto">
                            <table className="w-full text-[11px]">
                              <thead className="bg-purple-100/70 sticky top-0">
                                <tr>
                                  <th className="text-left p-1.5 font-medium">Hora</th>
                                  <th className="text-left p-1.5 font-medium">Cliente</th>
                                  <th className="text-left p-1.5 font-medium">Tipo</th>
                                  <th className="text-left p-1.5 font-medium">Referencia</th>
                                  <th className="text-right p-1.5 font-medium">Monto (Bs)</th>
                                  <th className="text-right p-1.5 font-medium">Monto ($)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {usdRefs.map((ref, idx) => (
                                  <tr key={`usd-${ref.saleId}-${idx}`} className="border-t hover:bg-purple-100/50">
                                    <td className="p-1.5 text-[10px]">{ref.saleTime}</td>
                                    <td className="p-1.5 text-[10px] truncate max-w-[80px]">{ref.customerName}</td>
                                    <td className="p-1.5">
                                      <Badge variant="outline" className={`text-[8px] ${ref.paymentType === 'Zelle' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-purple-200 text-purple-800 border-purple-300'}`}>
                                        {ref.paymentType === 'Zelle' ? 'Zelle' : 'USDT'}
                                      </Badge>
                                    </td>
                                    <td className="p-1.5 font-mono text-[10px] font-semibold tracking-wide">{ref.reference}</td>
                                    <td className="p-1.5 text-right font-bold text-purple-700">Bs {ref.totalBs.toFixed(2)}</td>
                                    <td className="p-1.5 text-right font-medium">{currency} {ref.totalUsd.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-purple-400 bg-purple-200/40 font-bold">
                                  <td colSpan={4} className="p-1.5 text-right text-[10px]">Total Dólares Digitales ({usdRefs.length} ops)</td>
                                  <td className="p-1.5 text-right text-[10px] text-purple-800">Bs {usdTotalBs.toFixed(2)}</td>
                                  <td className="p-1.5 text-right text-[10px]">{currency} {usdTotal.toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </>);
                  })()}
                </div>
              ) : !detailLoading && detailReferenceData ? (
                <div className="p-3 rounded border text-center text-muted-foreground">
                  <p className="text-xs">No hay transferencias, pagos moviles, Zelle ni USDT en este cierre.</p>
                </div>
              ) : null}

              {/* Tasa */}
              <div className="p-3 rounded border">
                <h4 className="font-semibold">Tasa de Cambio</h4>
                <p className="text-lg">
                  1 USD = <span className="font-bold">{selectedClosing.exchangeRate.toFixed(2)}</span> Bs
                </p>
              </div>

              {/* Observaciones */}
              {selectedClosing.observations && (
                <div className="p-3 rounded border">
                  <h4 className="font-semibold">Observaciones</h4>
                  <p className="text-muted-foreground">{selectedClosing.observations}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
