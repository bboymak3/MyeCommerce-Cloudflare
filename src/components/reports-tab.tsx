"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { printTicket } from "@/lib/ticket-printer";
import type { TicketSettings } from "@/lib/ticket-printer";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ReportsTabProps {
  bcvRate: number;
  currency: string;
}

interface SaleData {
  id: string;
  date: string;
  total: number;
  totalBs: number;
  subtotal?: number;
  discount?: number;
  taxAmount?: number;
  exchangeRate?: number;
  paymentMethod: string;
  customerName: string;
  clientDocType?: string;
  clientDocNumber?: string;
  clientAddress?: string;
  itemsCount: number;
  referenceNumber?: string;
  mixedPaymentJson?: string;
  sellerName?: string;
  isCredit?: boolean;
  creditDays?: number;
  creditDueDate?: string;
  notes?: string;
  items?: { id: string; productId: string; quantity: number; unitPrice: number; total: number; product?: { id: string; name: string } }[];
}

interface TopProduct {
  name: string;
  productName?: string;
  quantity: number;
  total: number;
  totalUsd?: number;
}

interface PaymentBreakdown {
  [method: string]: { count: number; totalUsd: number; totalBs: number };
}

interface ReferenceDetail {
  saleId: string;
  date: string;
  paymentType: string;
  reference: string;
  totalBs: number;
  totalUsd: number;
  customerName: string;
  saleTime: string;
}

interface SellerInfo {
  name: string;
  role?: string;
  roleLabel?: string;
  salesCount: number;
  totalUsd: number;
  totalBs: number;
  avgTicket: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  'efectivo-usd': "Efectivo ($)",
  cashea: "Cashea",
  transferencia: "Transferencia",
  "pago-movil": "Pago Movil",
  "punto-de-venta": "Punto de Venta",
  mixto: "Mixto",
  cheque: "Cheque",
  credito: "Credito",
  zelle: "Zelle ($)",
  usdt: "USDT ($)",
};

const CHART_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

// Period options organized by category
const PERIOD_GROUPS = [
  {
    label: "Por Dia",
    options: [
      { value: "today", label: "Hoy" },
      { value: "yesterday", label: "Ayer" },
    ],
  },
  {
    label: "Por Semana",
    options: [
      { value: "week", label: "Esta Semana" },
      { value: "lastWeek", label: "Semana Pasada" },
    ],
  },
  {
    label: "Por Mes",
    options: [
      { value: "month", label: "Este Mes" },
      { value: "lastMonth", label: "Mes Pasado" },
    ],
  },
  {
    label: "Quincenal",
    options: [
      { value: "fortnight1_1", label: "1ra Quincena (1-15)" },
      { value: "fortnight2", label: "2da Quincena (16-fin)" },
    ],
  },
  {
    label: "Trimestral",
    options: [
      { value: "quarter", label: "Este Trimestre" },
      { value: "lastQuarter", label: "Trimestre Pasado" },
    ],
  },
  {
    label: "Semestral",
    options: [
      { value: "semester", label: "Este Semestre" },
      { value: "lastSemester", label: "Semestre Pasado" },
    ],
  },
  {
    label: "Anual",
    options: [
      { value: "year", label: "Este Ano" },
      { value: "lastYear", label: "Ano Pasado" },
    ],
  },
  {
    label: "Personalizado",
    options: [
      { value: "custom", label: "Rango Personalizado" },
    ],
  },
];

const RANKING_MEDALS = ["&#127942;", "&#129351;", "&#129352;"]; // 🏆🥇🥈
const RANKING_BG = [
  "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300",
  "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300",
  "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300",
];

export default function ReportsTab({ bcvRate, currency }: ReportsTabProps) {
  const [period, setPeriod] = useState("today");
  const [sellerFilter, setSellerFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<SaleData[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalBs, setTotalBs] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({});
  const [referenceDetails, setReferenceDetails] = useState<ReferenceDetail[]>([]);
  const [transferTotal, setTransferTotal] = useState(0);
  const [mobileTotal, setMobileTotal] = useState(0);
  const [zelleTotalUsd, setZelleTotalUsd] = useState(0);
  const [usdtTotalUsd, setUsdtTotalUsd] = useState(0);
  const [sellerBreakdown, setSellerBreakdown] = useState<SellerInfo[]>([]);
  const [sellerList, setSellerList] = useState<string[]>([]);
  const [roleBreakdown, setRoleBreakdown] = useState<{ role: string; label: string; salesCount: number; totalUsd: number; totalBs: number }[]>([]);
  const [periodLabel, setPeriodLabel] = useState("Hoy");
  const [showFilters, setShowFilters] = useState(false);
  // Credit / Cuentas por Cobrar
  const [creditSalesCount, setCreditSalesCount] = useState(0);
  const [creditSalesTotal, setCreditSalesTotal] = useState(0);
  const [creditSalesTotalBs, setCreditSalesTotalBs] = useState(0);
  const [creditPaidTotal, setCreditPaidTotal] = useState(0);
  const [creditPaidBs, setCreditPaidBs] = useState(0);
  const [creditPendingTotal, setCreditPendingTotal] = useState(0);
  const [creditPendingBs, setCreditPendingBs] = useState(0);
  // Cashea (BNPL: Compra Ahora y Paga Despues)
  const [casheaSalesCount, setCasheaSalesCount] = useState(0);
  const [casheaSalesTotal, setCasheaSalesTotal] = useState(0);
  const [casheaSalesTotalBs, setCasheaSalesTotalBs] = useState(0);
  // Ventas Brutas (incluye TODO: efectivo, credito, cashea, etc.)
  const [grossTotalSales, setGrossTotalSales] = useState(0);
  const [grossTotalBs, setGrossTotalBs] = useState(0);

  const loadReport = async () => {
    setLoading(true);
    try {
      let url = `/api/reports?period=${period}`;
      if (sellerFilter) url += `&seller=${encodeURIComponent(sellerFilter)}`;
      if (roleFilter) url += `&role=${encodeURIComponent(roleFilter)}`;
      if (period === "custom" && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        setSales([]); setTotalSales(0); setTotalBs(0); setSalesCount(0);
        setTopProducts([]); setPaymentBreakdown({}); setReferenceDetails([]);
        setTransferTotal(0); setMobileTotal(0); setRoleBreakdown([]);
        setSellerBreakdown([]); setSellerList([]);
        setGrossTotalSales(0); setGrossTotalBs(0);
        setCasheaSalesCount(0); setCasheaSalesTotal(0); setCasheaSalesTotalBs(0);
      } else {
        setSales(data.sales || []);
        setTotalSales(data.totalSales || 0);
        setTotalBs(data.totalBs || 0);
        setGrossTotalSales(data.grossTotalSales || 0);
        setGrossTotalBs(data.grossTotalBs || 0);
        setSalesCount(data.salesCount || 0);
        setTopProducts(data.topProducts || []);
        setPaymentBreakdown(data.paymentBreakdown || {});
        setReferenceDetails(data.referenceDetails || []);
        setTransferTotal(data.transferTotal || 0);
        setMobileTotal(data.mobileTotal || 0);
        setZelleTotalUsd(data.zelleTotalUsd || 0);
        setUsdtTotalUsd(data.usdtTotalUsd || 0);
        setSellerBreakdown(data.sellerBreakdown || []);
        setSellerList(data.sellerList || []);
        setRoleBreakdown(data.roleBreakdown || []);
        setPeriodLabel(data.periodLabel || period);
        // Credit data
        setCreditSalesCount(data.creditSalesCount || 0);
        setCreditSalesTotal(data.creditSalesTotal || 0);
        setCreditSalesTotalBs(data.creditSalesTotalBs || 0);
        setCreditPaidTotal(data.creditPaidTotal || 0);
        setCreditPaidBs(data.creditPaidBs || 0);
        setCreditPendingTotal(data.creditPendingTotal || 0);
        setCreditPendingBs(data.creditPendingBs || 0);
        // Cashea (BNPL) data
        setCasheaSalesCount(data.casheaSalesCount || 0);
        setCasheaSalesTotal(data.casheaSalesTotal || 0);
        setCasheaSalesTotalBs(data.casheaSalesTotalBs || 0);
      }
    } catch {
      toast.error("Error al cargar reporte");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, sellerFilter, roleFilter]);

  const avgTicket = salesCount > 0 ? totalBs / salesCount : 0;

  // Sales by hour
  const salesByHour = useMemo(() => {
    const hourMap: Record<string, { count: number; totalBs: number }> = {};
    for (let h = 0; h < 24; h++) hourMap[`${h.toString().padStart(2, "0")}:00`] = { count: 0, totalBs: 0 };
    sales.forEach((s) => {
      const d = new Date(s.date);
      const label = `${d.getHours().toString().padStart(2, "0")}:00`;
      if (hourMap[label]) { hourMap[label].count++; hourMap[label].totalBs += s.totalBs; }
    });
    return Object.entries(hourMap).filter(([, v]) => v.count > 0)
      .map(([hour, data]) => ({ hour, ventas: data.count, totalBs: parseFloat(data.totalBs.toFixed(2)) }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [sales]);

  const paymentPieData = useMemo(() => {
    return Object.entries(paymentBreakdown).filter(([, v]) => v.count > 0)
      .map(([method, data]) => ({
        name: PAYMENT_LABELS[method] || method, value: parseFloat(data.totalBs.toFixed(2)),
        count: data.count, pct: totalBs > 0 ? ((data.totalBs / totalBs) * 100).toFixed(1) : "0",
      }));
  }, [paymentBreakdown, totalBs]);

  const paymentBarData = useMemo(() => {
    return Object.entries(paymentBreakdown).filter(([, v]) => v.count > 0)
      .map(([method, data]) => ({
        name: PAYMENT_LABELS[method] || method, cantidad: data.count,
        totalBs: parseFloat(data.totalBs.toFixed(2)),
      }));
  }, [paymentBreakdown]);

  const sellerBarData = useMemo(() => {
    return sellerBreakdown.map((s) => ({
      name: s.name.length > 15 ? s.name.substring(0, 15) + "..." : s.name,
      fullName: s.name, ventas: s.salesCount, totalBs: parseFloat(s.totalBs.toFixed(2)),
    }));
  }, [sellerBreakdown]);

  // ===== REIMPRIMIR TICKET (usa printTicket compartido — misma config que POS) =====
  const reprintReceipt = async (sale: SaleData) => {
    try {
      // Fetch sale with items if not already loaded
      let s = sale;
      if (!s.items || s.items.length === 0) {
        const res = await authFetch(`/api/sales?id=${s.id}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) s = { ...s, ...data[0] };
        else if (data.id) s = { ...s, ...data };
        else { toast.error("No se encontraron datos de la venta"); return; }
      }

      // Fetch store settings (LA MISMA config que usa el POS)
      const stRes = await authFetch("/api/settings");
      const st = await stRes.json();
      const ticketSettings: TicketSettings = {
        storeName: st.storeName || "Mi Tienda",
        storeRif: st.storeRif || "",
        storeAddress: st.storeAddress || "",
        storePhone: st.storePhone || "",
        ticketFontSize: parseInt(st.ticketFontSize) || 8,
        ticketFontFamily: st.ticketFontFamily || st.ticketFont || 'monospace',
        ticketBold: st.ticketBold !== false,
        ticketShowPhone: st.ticketShowPhone !== false,
        ticketShowSeller: st.ticketShowSeller !== false,
        ticketShowExchange: st.ticketShowExchange !== false,
        ticketShowSlogan: st.ticketShowSlogan === true,
        ticketPaperWidth: st.ticketPaperWidth || '58mm',
        ticketMarginLeft: parseFloat(st.ticketMarginLeft) || 0,
        ticketMarginRight: parseFloat(st.ticketMarginRight) || 0,
        ticketHeaderMsg: st.ticketHeaderMsg || "",
        ticketFooterMsg: st.ticketFooterMsg || "",
        ticketUseAgent: st.ticketUseAgent !== false,
        ticketAgentUrl: st.ticketAgentUrl || 'http://localhost:9100',
        ticketCurrencyMode: st.ticketCurrencyMode || 'dual',
      };

      await printTicket({ receipt: s, settings: ticketSettings, currency });
    } catch (error: any) {
      toast.error("Reimprimir: " + (error.message || "desconocido"), { duration: 8000 });
    }
  };

  // ===== PRINT =====
  const printReport = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) { toast.error('No se pudo abrir ventana'); return; }
    const now = new Date().toLocaleString("es-VE");
    const sellerLabel = sellerFilter ? ` | Vendedor: ${sellerFilter}` : '';
    const roleLabel = roleFilter ? ` | Rol: ${roleFilter === "admin" ? "Administrador" : roleFilter === "vendedor" ? "Vendedor" : "Cajero"}` : '';

    const bsRefRows = referenceDetails.filter(r => r.paymentType === 'Transferencia' || r.paymentType === 'Pago Movil').map((r) =>
      `<tr><td>${r.saleTime}</td><td>${r.customerName}</td><td><strong>${r.paymentType}</strong></td><td class="ref">${r.reference}</td><td class="amount">Bs ${r.totalBs.toFixed(2)}</td></tr>`
    ).join('');
    const usdRefRows = referenceDetails.filter(r => r.paymentType === 'Zelle' || r.paymentType === 'USDT').map((r) =>
      `<tr><td>${r.saleTime}</td><td>${r.customerName}</td><td><strong>${r.paymentType}</strong></td><td class="ref">${r.reference}</td><td class="amount">$ ${r.totalUsd.toFixed(2)}</td></tr>`
    ).join('');

    const payRows = Object.entries(paymentBreakdown).filter(([, v]) => v.count > 0)
      .map(([method, data]) => {
        const pct = totalBs > 0 ? ((data.totalBs / totalBs) * 100).toFixed(1) : "0";
        return `<tr><td>${PAYMENT_LABELS[method] || method}</td><td>${data.count}</td><td>$ ${data.totalUsd.toFixed(2)}</td><td>Bs ${data.totalBs.toFixed(2)}</td><td>${pct}%</td></tr>`;
      }).join('');

    const sellerRows = sellerBreakdown.map((s, i) => {
      const pct = sellerBreakdown.reduce((sum, x) => sum + x.totalBs, 0) > 0
        ? ((s.totalBs / sellerBreakdown.reduce((sum, x) => sum + x.totalBs, 0)) * 100).toFixed(1) : "0";
      return `<tr>
        <td>#${i + 1}</td><td>${s.name}${s.roleLabel ? ' (' + s.roleLabel + ')' : ''}</td><td>${s.salesCount}</td>
        <td>$ ${s.totalUsd.toFixed(2)}</td><td>Bs ${s.totalBs.toFixed(2)}</td><td>Bs ${s.avgTicket.toFixed(2)}</td><td>${pct}%</td>
      </tr>`;
    }).join('');

    const allSellerTotalBs = sellerBreakdown.reduce((sum, s) => sum + s.totalBs, 0);
    const allSellerTotalUsd = sellerBreakdown.reduce((sum, s) => sum + s.totalUsd, 0);
    const allSellerCount = sellerBreakdown.reduce((sum, s) => sum + s.salesCount, 0);

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Reporte - ${periodLabel}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:15px;color:#333}
        .header{text-align:center;margin-bottom:15px;border-bottom:2px solid #333;padding-bottom:10px}
        .header h1{font-size:18px;margin-bottom:4px}.header .sub{font-size:11px;color:#666}
        .summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:15px}
        .summary .card{border:1px solid #ddd;border-radius:6px;padding:8px;text-align:center}
        .summary .card .label{font-size:9px;color:#888;text-transform:uppercase}
        .summary .card .value{font-size:16px;font-weight:bold;margin-top:2px}
        .cashea-box{background:#faf5ff;border:1px solid #a855f7;border-radius:6px;padding:8px;margin-bottom:15px;font-size:11px}
        .cashea-box h3{color:#7e22ce;font-size:13px;margin-bottom:4px}
        h2{font-size:14px;margin:15px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}
        th{background:#f5f5f5;text-align:left;padding:6px 4px;border-bottom:1px solid #ddd;font-size:10px;text-transform:uppercase}
        td{padding:5px 4px;border-bottom:1px solid #eee}
        td.ref{font-family:monospace;font-size:10px;letter-spacing:0.5px}
        td.amount{text-align:right;font-weight:600}
        .totals-row td{font-weight:bold;background:#f0f9ff}
        .footer{text-align:center;margin-top:15px;font-size:9px;color:#999;border-top:1px solid #ddd;padding-top:8px}
        @media print{body{padding:5px}}
      </style></head><body>
      <div class="header">
        <h1>Reporte de Ventas</h1>
        <div class="sub">Periodo: ${periodLabel}${sellerLabel}${roleLabel} | Generado: ${now} | Tasa: 1$ = ${bcvRate.toFixed(2)} Bs</div>
      </div>
      <div class="summary">
        <div class="card"><div class="label">Ventas Brutas (Bs)</div><div class="value" style="color:#059669">Bs ${grossTotalBs.toFixed(2)}</div></div>
        <div class="card"><div class="label">Ventas Brutas ($)</div><div class="value" style="color:#059669">$ ${grossTotalSales.toFixed(2)}</div></div>
        <div class="card"><div class="label">Entradas Netas (Bs)</div><div class="value" style="color:#16a34a">Bs ${totalBs.toFixed(2)}</div></div>
        <div class="card"><div class="label">Entradas Netas ($)</div><div class="value" style="color:#16a34a">$ ${totalSales.toFixed(2)}</div></div>
      </div>
      ${casheaSalesCount > 0 ? `
      <div class="cashea-box">
        <h3>&#128241; Cashea (Compra Ahora y Paga Despues) - BNPL</h3>
        <p><strong>${casheaSalesCount} venta(s)</strong> por <strong>$ ${casheaSalesTotal.toFixed(2)}</strong> / <strong>Bs ${casheaSalesTotalBs.toFixed(2)}</strong>.</p>
        <p style="color:#6b21a8;font-size:10px;margin-top:4px">Este dinero NO entra a caja en el momento de la venta: Cashea lo transfiere despues desde la app. Por eso se contabiliza en Ventas Brutas pero se excluye de Entradas Netas.</p>
      </div>` : ''}
      <div class="summary">
        <div class="card"><div class="label">Num. Ventas</div><div class="value">${salesCount}</div></div>
        <div class="card"><div class="label">Ticket Promedio</div><div class="value">Bs ${avgTicket.toFixed(2)}</div></div>
        <div class="card"><div class="label">Ventas Cashea</div><div class="value" style="color:#7e22ce">${casheaSalesCount}</div></div>
        <div class="card"><div class="label">Ventas Credito</div><div class="value" style="color:#d97706">${creditSalesCount}</div></div>
      </div>
      <h2>Ranking de Vendedores</h2>
      <table>
        <thead><tr><th>#</th><th>Vendedor</th><th>Ventas</th><th>Total $</th><th>Total Bs</th><th>Promedio</th><th>%</th></tr></thead>
        <tbody>
          ${sellerRows}
          <tr class="totals-row"><td>-</td><td>TOTAL</td><td>${allSellerCount}</td><td>$ ${allSellerTotalUsd.toFixed(2)}</td><td>Bs ${allSellerTotalBs.toFixed(2)}</td><td>-</td><td>100%</td></tr>
        </tbody>
      </table>
      ${roleBreakdown.length > 0 ? `<h2>Ventas por Rol</h2><table><thead><tr><th>Rol</th><th>Ventas</th><th>Total $</th><th>Total Bs</th><th>%</th></tr></thead><tbody>
        ${roleBreakdown.map((r) => {const rT = roleBreakdown.reduce((s, x) => s + x.totalBs, 0); const rP = rT > 0 ? ((r.totalBs / rT) * 100).toFixed(1) : "0"; return `<tr><td>${r.label}</td><td>${r.salesCount}</td><td>$ ${r.totalUsd.toFixed(2)}</td><td>Bs ${r.totalBs.toFixed(2)}</td><td>${rP}%</td></tr>`;}).join('')}
      </tbody></table>` : ''}
      <h2>Cuentas por Cobrar (Credito)</h2><table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Total $</th><th>Total Bs</th></tr></thead><tbody>
        <tr><td>Ventas a Credito</td><td>${creditSalesCount}</td><td>$ ${creditSalesTotal.toFixed(2)}</td><td>Bs ${creditSalesTotalBs.toFixed(2)}</td></tr>
        <tr><td>Total Cobrado</td><td>-</td><td class="amount" style="color:green">$ ${creditPaidTotal.toFixed(2)}</td><td class="amount" style="color:green">Bs ${creditPaidBs.toFixed(2)}</td></tr>
        <tr><td>Pendiente de Cobro</td><td>-</td><td class="amount" style="color:red">$ ${creditPendingTotal.toFixed(2)}</td><td class="amount" style="color:red">Bs ${creditPendingBs.toFixed(2)}</td></tr>
      </tbody></table>
      ${casheaSalesCount > 0 ? `<h2>&#128241; Ventas por Cashea (BNPL)</h2><table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Total $</th><th>Total Bs</th></tr></thead><tbody>
        <tr><td>Ventas por Cashea</td><td>${casheaSalesCount}</td><td>$ ${casheaSalesTotal.toFixed(2)}</td><td>Bs ${casheaSalesTotalBs.toFixed(2)}</td></tr>
        <tr><td colspan="4" style="font-size:10px;color:#6b21a8;font-style:italic">El dinero de Cashea se recibe despues desde la app, no entra a caja en el momento de la venta.</td></tr>
      </tbody></table>` : ''}
      <h2>Desglose por Metodo de Pago</h2>
      <table><thead><tr><th>Metodo</th><th>Cant.</th><th>Total $</th><th>Total Bs</th><th>%</th></tr></thead><tbody>
        ${payRows}
        <tr class="totals-row"><td>TOTAL BRUTO</td><td>${salesCount}</td><td>$ ${grossTotalSales.toFixed(2)}</td><td>Bs ${grossTotalBs.toFixed(2)}</td><td>100%</td></tr>
      </tbody></table>
      ${bsRefRows ? `<h2>Bs Electronicos — Transferencia + Pago Movil</h2><table><thead><tr><th>Fecha/Hora</th><th>Cliente</th><th>Tipo</th><th>Referencia</th><th style="text-align:right">Monto (Bs)</th></tr></thead><tbody>${bsRefRows}</tbody></table>` : ''}
      ${usdRefRows ? `<h2>USD Electronicos — Zelle + USDT</h2><table><thead><tr><th>Fecha/Hora</th><th>Cliente</th><th>Tipo</th><th>Referencia</th><th style="text-align:right">Monto ($)</th></tr></thead><tbody>${usdRefRows}</tbody></table>` : ''}
      ${topProducts.length > 0 ? `<h2>Top Productos</h2><table><thead><tr><th>#</th><th>Producto</th><th>Cant.</th><th>Total $</th><th>Total Bs</th></tr></thead><tbody>${topProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.productName || p.name || 'Producto'}</td><td>${p.quantity || 0}</td><td>$ ${(p.total || p.totalUsd || 0).toFixed(2)}</td><td>Bs ${((p.total || p.totalUsd || 0) * bcvRate).toFixed(2)}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="footer">Reporte generado por MyeCommerce POS v2.9.6</div>
      <script>window.onload=function(){window.print();}</script></body></html>`);
    printWindow.document.close();
  };

  // ===== EXPORT CSV =====
  const exportCsv = () => {
    if (sales.length === 0) { toast.error("No hay datos para exportar"); return; }
    try {
      const BOM = "\uFEFF";
      const sellerLabel = sellerFilter ? `Vendedor: ${sellerFilter}` : '';
      const roleLabel = roleFilter ? `Rol: ${roleFilter}` : '';
      const filterInfo = [sellerLabel, roleLabel].filter(Boolean).join(' | ');

      let csv = BOM;
      // Metadata header
      csv += `Reporte de Ventas - MyeCommerce POS v2.9.6\n`;
      csv += `Periodo: ${periodLabel}${filterInfo ? ' | ' + filterInfo : ''}\n`;
      csv += `Generado: ${new Date().toLocaleString("es-VE")}\n`;
      csv += `Tasa: 1$ = ${bcvRate.toFixed(2)} Bs\n`;
      csv += `\n`;

      // Summary
      csv += `RESUMEN\n`;
      csv += `Ventas Brutas (Bs);Ventas Brutas ($);Entradas Netas (Bs);Entradas Netas ($);Num. Ventas;Ticket Promedio (Bs)\n`;
      csv += `${grossTotalBs.toFixed(2)};${grossTotalSales.toFixed(2)};${totalBs.toFixed(2)};${totalSales.toFixed(2)};${salesCount};${avgTicket.toFixed(2)}\n`;
      csv += `\n`;
      csv += `NOTA: Ventas Brutas incluye TODO (efectivo, cashea, credito, mixto). Entradas Netas excluye Cashea y Credito (no entran a caja en el momento de la venta).\n`;
      csv += `\n`;

      // Cashea (BNPL) section
      csv += `VENTAS POR CASHEA (BNPL - Compra Ahora y Paga Despues)\n`;
      csv += `Concepto;Cantidad;Total $;Total Bs\n`;
      csv += `Ventas por Cashea;${casheaSalesCount};${casheaSalesTotal.toFixed(2)};${casheaSalesTotalBs.toFixed(2)}\n`;
      csv += `Nota: El dinero de Cashea se recibe despues desde la app, no entra a caja en el momento de la venta.\n`;
      csv += `\n`;

      // Seller ranking
      if (sellerBreakdown.length > 0) {
        csv += `RANKING DE VENDEDORES\n`;
        csv += `#;Vendedor;Rol;Ventas;Total $;Total Bs;Promedio;Porcentaje\n`;
        const totalSellerBs = sellerBreakdown.reduce((s, x) => s + x.totalBs, 0);
        sellerBreakdown.forEach((s, i) => {
          const pct = totalSellerBs > 0 ? ((s.totalBs / totalSellerBs) * 100).toFixed(1) : "0";
          csv += `${i + 1};"${s.name}";${s.roleLabel || ''};${s.salesCount};${s.totalUsd.toFixed(2)};${s.totalBs.toFixed(2)};${s.avgTicket.toFixed(2)};${pct}%\n`;
        });
        csv += `\n`;
      }

      // Role breakdown
      if (roleBreakdown.length > 0) {
        csv += `VENTAS POR ROL\n`;
        csv += `Rol;Ventas;Total $;Total Bs;Porcentaje\n`;
        const totalRoleBs = roleBreakdown.reduce((s, x) => s + x.totalBs, 0);
        roleBreakdown.forEach((r) => {
          const pct = totalRoleBs > 0 ? ((r.totalBs / totalRoleBs) * 100).toFixed(1) : "0";
          csv += `"${r.label}";${r.salesCount};${r.totalUsd.toFixed(2)};${r.totalBs.toFixed(2)};${pct}%\n`;
        });
        csv += `\n`;
      }

      // Credit / Cuentas por Cobrar (always included)
      csv += `CUENTAS POR COBRAR\n`;
      csv += `Concepto;Cantidad;Total $;Total Bs\n`;
      csv += `Ventas a Credito;${creditSalesCount};${creditSalesTotal.toFixed(2)};${creditSalesTotalBs.toFixed(2)}\n`;
      csv += `Total Cobrado;-;${creditPaidTotal.toFixed(2)};${creditPaidBs.toFixed(2)}\n`;
      csv += `Pendiente de Cobro;-;${creditPendingTotal.toFixed(2)};${creditPendingBs.toFixed(2)}\n`;
      csv += `\n`;

      // Payment breakdown
      csv += `DESGLOSE POR METODO DE PAGO\n`;
      csv += `Metodo;Cantidad;Total $;Total Bs;Porcentaje\n`;
      Object.entries(paymentBreakdown).filter(([, v]) => v.count > 0).forEach(([method, data]) => {
        const pct = totalBs > 0 ? ((data.totalBs / totalBs) * 100).toFixed(1) : "0";
        csv += `"${PAYMENT_LABELS[method] || method}";${data.count};${data.totalUsd.toFixed(2)};${data.totalBs.toFixed(2)};${pct}%\n`;
      });
      csv += `\n`;

      // References
      if (referenceDetails.length > 0) {
        csv += `TRANSFERENCIAS Y PAGO MOVIL\n`;
        csv += `Fecha/Hora;Cliente;Tipo;Referencia;Monto (Bs)\n`;
        referenceDetails.forEach((r) => {
          csv += `"${r.saleTime}";"${r.customerName}";"${r.paymentType}";"${r.reference}";${r.totalBs.toFixed(2)}\n`;
        });
        csv += `\n`;
      }

      // Top products
      if (topProducts.length > 0) {
        csv += `TOP 10 PRODUCTOS\n`;
        csv += `#;Producto;Cantidad;Total $\n`;
        topProducts.forEach((p, i) => {
          csv += `${i + 1};"${p.name}";${p.quantity};${p.total.toFixed(2)}\n`;
        });
        csv += `\n`;
      }

      // Sales detail
      csv += `DETALLE DE VENTAS\n`;
      csv += `Fecha;Vendedor;Cliente;Metodo;Referencia;Total Bs;Total $\n`;
      sales.forEach((sale) => {
        const saleAny = sale as any;
        const date = new Date(sale.date).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        const seller = sale.sellerName || "";
        const client = sale.customerName || "Cliente Final";
        const isCreditSale = (sale as any).isCredit === true;
        const method = isCreditSale ? 'Credito' : (PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod);
        let ref = "";
        if (!isCreditSale && ["transferencia", "pago-movil", "zelle", "usdt"].includes(sale.paymentMethod)) {
          ref = saleAny.referenceNumber || "";
        } else if (!isCreditSale && sale.paymentMethod === "mixto" && saleAny.mixedPaymentJson) {
          try {
            const entries = JSON.parse(saleAny.mixedPaymentJson);
            const refEntries = entries.filter((e: any) => (e.method === "transferencia" || e.method === "pago-movil" || e.method === "zelle" || e.method === "usdt") && e.reference);
            ref = refEntries.map((e: any) => `${e.reference} (Bs ${parseFloat(e.amountBs).toFixed(2)})`).join(" | ");
          } catch {}
        }
        // Escape quotes in fields
        const esc = (s: string) => s.replace(/"/g, '""');
        csv += `"${esc(date)}";"${esc(seller)}";"${esc(client)}";"${esc(method)}";"${esc(ref)}";${sale.totalBs.toFixed(2)};${sale.total.toFixed(2)}\n`;
      });

      // Download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeLabel = periodLabel.replace(/[^a-zA-Z0-9]/g, "_");
      a.download = `reporte_ventas_${safeLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV exportado correctamente");
    } catch (error: any) {
      toast.error("Error al exportar CSV: " + (error.message || ""));
    }
  };

  // ===== EXPORT EXCEL (XLSX) =====
  const exportXlsx = () => {
    if (sales.length === 0) { toast.error("No hay datos para exportar"); return; }
    try {
      const wb = XLSX.utils.book_new();
      
      // Sheet 1: Resumen
      const summaryData = [
        ["REPORTE DE VENTAS - MyeCommerce POS"],
        ["Periodo", periodLabel],
        ["Generado", new Date().toLocaleString("es-VE")],
        ["Tasa", "1$ = " + bcvRate.toFixed(2) + " Bs"],
        [],
        ["RESUMEN"],
        ["Ventas Brutas (Bs)", grossTotalBs.toFixed(2)],
        ["Ventas Brutas ($)", grossTotalSales.toFixed(2)],
        ["Entradas Netas (Bs)", totalBs.toFixed(2)],
        ["Entradas Netas ($)", totalSales.toFixed(2)],
        ["Num. Ventas", salesCount],
        ["Ticket Promedio (Bs)", avgTicket.toFixed(2)],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

      // Sheet 2: Ventas Detalladas
      const salesData = sales.map((s: any, i: number) => ({
        "#": i + 1,
        "Fecha": new Date(s.date).toLocaleDateString("es-VE"),
        "Hora": new Date(s.date).toLocaleTimeString("es-VE"),
        "Vendedor": s.sellerName || "",
        "Cliente": s.clientName || s.customerName || "",
        "Metodo": s.paymentMethod || "",
        "Referencia": s.referenceNumber || "",
        "Total $": s.total || 0,
        "Total Bs": s.totalBs || 0,
        "Descuento $": s.discount || 0,
        "Nota": s.isCredit ? "CREDITO" : "",
      }));
      const ws2 = XLSX.utils.json_to_sheet(salesData);
      XLSX.utils.book_append_sheet(wb, ws2, "Ventas");

      // Sheet 3: Top Productos
      if (topProducts && topProducts.length > 0) {
        const prodData = topProducts.map((p: any, i: number) => ({
          "#": i + 1,
          "Producto": p.productName || p.name || "",
          "Cantidad": p.quantity || 0,
          "Total $": p.total || p.totalUsd || 0,
          "Total Bs": ((p.total || p.totalUsd || 0) * bcvRate).toFixed(2),
        }));
        const ws3 = XLSX.utils.json_to_sheet(prodData);
        XLSX.utils.book_append_sheet(wb, ws3, "Top Productos");
      }

      XLSX.writeFile(wb, `reporte-ventas-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Reporte Excel exportado");
    } catch (e: any) { toast.error("Error al exportar Excel: " + e.message); }
  };

  // ===== EXPORT PDF =====
  const exportPdf = () => {
    if (sales.length === 0) { toast.error("No hay datos para exportar"); return; }
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      // Title
      doc.setFontSize(16);
      doc.text("Reporte de Ventas - MyeCommerce POS", 14, 15);
      doc.setFontSize(9);
      doc.text(`Periodo: ${periodLabel}`, 14, 22);
      doc.text(`Tasa: 1$ = ${bcvRate.toFixed(2)} Bs`, 14, 27);
      doc.text(`Generado: ${new Date().toLocaleString("es-VE")}`, 14, 32);

      // Summary box
      doc.setFontSize(11);
      doc.text("Resumen", 14, 40);
      doc.setFontSize(9);
      doc.text(`Ventas Brutas: Bs ${grossTotalBs.toFixed(2)} | $ ${grossTotalSales.toFixed(2)}`, 14, 46);
      doc.text(`Entradas Netas: Bs ${totalBs.toFixed(2)} | $ ${totalSales.toFixed(2)}`, 14, 51);
      doc.text(`Num. Ventas: ${salesCount} | Ticket Promedio: Bs ${avgTicket.toFixed(2)}`, 14, 56);

      // Sales table
      const tableData = sales.map((s: any, i: number) => [
        i + 1,
        new Date(s.date).toLocaleDateString("es-VE"),
        new Date(s.date).toLocaleTimeString("es-VE", { hour: '2-digit', minute: '2-digit' }),
        s.sellerName || "-",
        (s.clientName || s.customerName || "Final").substring(0, 20),
        s.paymentMethod || "",
        `$${(s.total || 0).toFixed(2)}`,
        `Bs${(s.totalBs || 0).toFixed(2)}`,
      ]);

      (doc as any).autoTable({
        startY: 62,
        head: [["#", "Fecha", "Hora", "Vendedor", "Cliente", "Metodo", "Total $", "Total Bs"]],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
      });

      doc.save(`reporte-ventas-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Reporte PDF exportado");
    } catch (e: any) { toast.error("Error al exportar PDF: " + e.message); }
  };

  // Today for default date inputs
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* ====== FILTROS AVANZADOS ====== */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-base">&#128200;</span> Filtros del Reporte
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? "Ocultar filtros" : "Mas filtros"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Row 1: Period selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Periodo:</span>
              <Select value={period} onChange={(e: any) => setPeriod(e.target.value)} className="w-auto">
                {PERIOD_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
          </div>

          {/* Custom date range */}
          {period === "custom" && (
            <div className="flex items-center gap-2 flex-wrap p-2 rounded bg-muted/50 border">
              <span className="text-xs font-medium">Desde:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 px-2 text-xs border rounded bg-background"
              />
              <span className="text-xs font-medium">Hasta:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 px-2 text-xs border rounded bg-background"
              />
              {(customStart || customEnd) && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setCustomStart(""); setCustomEnd(""); }}>
                  Limpiar
                </Button>
              )}
            </div>
          )}

          {/* Row 2: Extra filters */}
          {showFilters && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Vendedor:</span>
                <Select value={sellerFilter} onChange={(e: any) => setSellerFilter(e.target.value)} className="w-auto">
                  <option value="">Todos</option>
                  {sellerList.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Rol:</span>
                <Select value={roleFilter} onChange={(e: any) => setRoleFilter(e.target.value)} className="w-auto">
                  <option value="">Todos</option>
                  <option value="admin">Administrador</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="cajero">Cajero</option>
                </Select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={loadReport} disabled={loading || (period === "custom" && (!customStart || !customEnd))}>
              {loading ? "Cargando..." : "Generar Reporte"}
            </Button>
            <Button variant="outline" size="sm" onClick={printReport} disabled={sales.length === 0}>
              Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={sales.length === 0}>
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx} disabled={sales.length === 0}>
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={sales.length === 0}>
              PDF
            </Button>
            {(sellerFilter || roleFilter) && (
              <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => { setSellerFilter(""); setRoleFilter(""); }}>
                Quitar filtros
              </Button>
            )}
          </div>

          {/* Active filters */}
          {(sellerFilter || roleFilter) && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-xs">Periodo: {periodLabel}</Badge>
              {sellerFilter && <Badge variant="secondary" className="text-xs">Vendedor: {sellerFilter}</Badge>}
              {roleFilter && <Badge variant="outline" className="text-xs">Rol: {roleFilter === "admin" ? "Administrador" : roleFilter === "vendedor" ? "Vendedor" : "Cajero"}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== RESUMEN ====== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Ventas Brutas (Bs) - incluye TODO</p>
            <p className="text-xl font-bold text-emerald-600">Bs {grossTotalBs.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Ventas Brutas ($)</p>
            <p className="text-xl font-bold text-emerald-600">{currency} {grossTotalSales.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Entradas Netas (Caja) Bs</p>
            <p className="text-xl font-bold text-green-600">Bs {totalBs.toFixed(2)}</p>
            <p className="text-[9px] text-muted-foreground">Sin Cashea ni Credito</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Entradas Netas ($)</p>
            <p className="text-xl font-bold text-green-600">{currency} {totalSales.toFixed(2)}</p>
            <p className="text-[9px] text-muted-foreground">Num. Ventas: {salesCount} | Prom: Bs {avgTicket.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ====== VENTAS POR CASHEA (BNPL) ====== */}
      <Card className={`border-purple-300 bg-purple-50/30 ${casheaSalesCount > 0 ? '' : 'opacity-60'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-base">&#128241;</span> Ventas por Cashea (BNPL)
            <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge>
            <Badge variant="outline" className="text-[9px] text-purple-700 border-purple-300">Compra Ahora, Paga Despues</Badge>
            {casheaSalesCount > 0 && <Badge variant="outline" className="text-[9px] text-purple-600 border-purple-300">{casheaSalesCount} venta(s)</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50">
              <p className="text-[10px] text-muted-foreground">Ventas por Cashea</p>
              <p className="text-lg font-bold text-purple-600">{casheaSalesCount}</p>
              <p className="text-xs text-muted-foreground">{currency} {casheaSalesTotal.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Bs {casheaSalesTotalBs.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
              <p className="text-[10px] text-muted-foreground">% del Total Bruto</p>
              <p className="text-lg font-bold text-blue-600">
                {grossTotalSales > 0 ? ((casheaSalesTotal / grossTotalSales) * 100).toFixed(1) : "0"}%
              </p>
              <p className="text-[9px] text-muted-foreground">Participacion de Cashea en ventas brutas</p>
            </div>
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
              <p className="text-[10px] text-muted-foreground">Entradas Netas (sin Cashea)</p>
              <p className="text-lg font-bold text-amber-600">{currency} {totalSales.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Bs {totalBs.toFixed(2)}</p>
              <p className="text-[9px] text-amber-600">Dinero que SI entra a caja en el periodo</p>
            </div>
          </div>
          <div className="mt-3 p-2 bg-purple-100/60 rounded border border-purple-200 text-xs text-purple-800 flex items-start gap-2">
            <span className="text-base flex-shrink-0">&#128241;</span>
            <div>
              <strong>Cashea (Compra Ahora y Paga Despues):</strong> Este dinero NO entra a caja en el momento de la venta.
              Cashea lo transfiere despues desde la app. Por eso se contabiliza en <strong>Ventas Brutas</strong> pero se excluye de <strong>Entradas Netas</strong>.
              {casheaSalesCount > 0
                ? ` Hay ${casheaSalesCount} venta(s) por Cashea en este periodo.`
                : ' No hay ventas por Cashea en este periodo.'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== CUENTAS POR COBRAR ====== */}
      <Card className="border-orange-300 bg-orange-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-base">&#128176;</span> Cuentas por Cobrar
            <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge>
            {creditSalesCount > 0 && <Badge variant="outline" className="text-[9px] text-orange-600 border-orange-300">{creditSalesCount} venta(s)</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/50">
                <p className="text-[10px] text-muted-foreground">Ventas a Credito</p>
                <p className="text-lg font-bold text-orange-600">{creditSalesCount}</p>
                <p className="text-xs text-muted-foreground">{currency} {creditSalesTotal.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Bs {creditSalesTotalBs.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg border border-green-200 bg-green-50/50">
                <p className="text-[10px] text-muted-foreground">Total Cobrado</p>
                <p className="text-lg font-bold text-green-600">{currency} {creditPaidTotal.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Bs {creditPaidBs.toFixed(2)}</p>
                <p className="text-[9px] text-green-500">{creditSalesTotal > 0 ? ((creditPaidTotal / creditSalesTotal) * 100).toFixed(1) : "0"}% recaudado</p>
              </div>
              <div className="p-3 rounded-lg border border-red-200 bg-red-50/50">
                <p className="text-[10px] text-muted-foreground">Pendiente de Cobro</p>
                <p className="text-lg font-bold text-red-600">{currency} {creditPendingTotal.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Bs {creditPendingBs.toFixed(2)}</p>
                <p className="text-[9px] text-red-500">{creditSalesTotal > 0 ? ((creditPendingTotal / creditSalesTotal) * 100).toFixed(1) : "0"}% pendiente</p>
              </div>
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                <p className="text-[10px] text-muted-foreground">Saldo Neto</p>
                <p className="text-lg font-bold text-blue-600">{currency} {(creditSalesTotal - creditPaidTotal).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Bs {(creditSalesTotalBs - creditPaidBs).toFixed(2)}</p>
                <p className="text-[9px] text-blue-500">Por cobrar neto</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Progreso de cobro</span>
                <span>{creditSalesTotal > 0 ? ((creditPaidTotal / creditSalesTotal) * 100).toFixed(1) : "0"}%</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all"
                  style={{ width: `${creditSalesTotal > 0 ? Math.min((creditPaidTotal / creditSalesTotal) * 100, 100) : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

      {/* ====== RANKING DE VENDEDORES ====== */}
      {sellerBreakdown.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span>&#127942;</span> Ranking de Vendedores
              <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Podium for top 3 */}
            {sellerBreakdown.length >= 3 && !sellerFilter && (
              <div className="flex items-end justify-center gap-2 py-4">
                {/* 2nd place */}
                <div className="flex flex-col items-center w-28">
                  <div className="text-2xl mb-1" dangerouslySetInnerHTML={{ __html: RANKING_MEDALS[1] }} />
                  <p className="text-xs font-bold truncate max-w-full text-center">{sellerBreakdown[1].name}</p>
                  <p className="text-[10px] text-muted-foreground">{sellerBreakdown[1].roleLabel || ''}</p>
                  <div className="mt-1 w-full p-2 rounded-t-lg border text-center bg-gradient-to-t from-gray-100 to-gray-50 border-gray-300" style={{ height: "80px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p className="text-sm font-bold text-gray-700">Bs {sellerBreakdown[1].totalBs.toFixed(0)}</p>
                    <p className="text-[10px] text-gray-500">{sellerBreakdown[1].salesCount} ventas</p>
                  </div>
                </div>
                {/* 1st place */}
                <div className="flex flex-col items-center w-32">
                  <div className="text-3xl mb-1" dangerouslySetInnerHTML={{ __html: RANKING_MEDALS[0] }} />
                  <p className="text-sm font-bold truncate max-w-full text-center">{sellerBreakdown[0].name}</p>
                  <p className="text-[10px] text-muted-foreground">{sellerBreakdown[0].roleLabel || ''}</p>
                  <div className="mt-1 w-full p-2 rounded-t-lg border text-center bg-gradient-to-t from-yellow-100 to-amber-50 border-yellow-300" style={{ height: "120px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p className="text-lg font-bold text-yellow-700">Bs {sellerBreakdown[0].totalBs.toFixed(0)}</p>
                    <p className="text-[10px] text-yellow-600">{sellerBreakdown[0].salesCount} ventas</p>
                  </div>
                </div>
                {/* 3rd place */}
                <div className="flex flex-col items-center w-28">
                  <div className="text-2xl mb-1" dangerouslySetInnerHTML={{ __html: RANKING_MEDALS[2] }} />
                  <p className="text-xs font-bold truncate max-w-full text-center">{sellerBreakdown[2].name}</p>
                  <p className="text-[10px] text-muted-foreground">{sellerBreakdown[2].roleLabel || ''}</p>
                  <div className="mt-1 w-full p-2 rounded-t-lg border text-center bg-gradient-to-t from-orange-100 to-orange-50 border-orange-300" style={{ height: "60px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p className="text-sm font-bold text-orange-700">Bs {sellerBreakdown[2].totalBs.toFixed(0)}</p>
                    <p className="text-[10px] text-orange-500">{sellerBreakdown[2].salesCount} ventas</p>
                  </div>
                </div>
              </div>
            )}

            {/* Full ranking table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium text-xs w-10">#</th>
                    <th className="text-left p-2 font-medium text-xs">Vendedor</th>
                    <th className="text-center p-2 font-medium text-xs">Ventas</th>
                    <th className="text-right p-2 font-medium text-xs">Total Bs</th>
                    <th className="text-right p-2 font-medium text-xs">Total $</th>
                    <th className="text-right p-2 font-medium text-xs">Promedio</th>
                    <th className="text-center p-2 font-medium text-xs w-16">%</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerBreakdown.map((seller, idx) => {
                    const totalAllBs = sellerBreakdown.reduce((s, x) => s + x.totalBs, 0);
                    const pct = totalAllBs > 0 ? ((seller.totalBs / totalAllBs) * 100).toFixed(1) : "0";
                    const isSelected = sellerFilter === seller.name;
                    return (
                      <tr
                        key={seller.name}
                        className={`border-t cursor-pointer transition-all hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""} ${idx < 3 && !sellerFilter ? RANKING_BG[idx] || "" : ""}`}
                        onClick={() => setSellerFilter(isSelected ? "" : seller.name)}
                      >
                        <td className="p-2 text-xs font-bold text-muted-foreground">
                          {idx < 3 && !sellerFilter ? (
                            <span className="text-base" dangerouslySetInnerHTML={{ __html: RANKING_MEDALS[idx + 1] || "" }} />
                          ) : (
                            `#${idx + 1}`
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{seller.name}</span>
                            {seller.roleLabel && (
                              <Badge variant="outline" className="text-[8px] w-fit mt-0.5">{seller.roleLabel}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-center font-medium">{seller.salesCount}</td>
                        <td className="p-2 text-right font-bold text-green-600">Bs {seller.totalBs.toFixed(2)}</td>
                        <td className="p-2 text-right font-medium">{currency} {seller.totalUsd.toFixed(2)}</td>
                        <td className="p-2 text-right text-xs">Bs {seller.avgTicket.toFixed(2)}</td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className="text-[10px] font-bold">{pct}%</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/50 font-bold">
                    <td className="p-2 text-xs">-</td>
                    <td className="p-2 text-sm">TOTAL</td>
                    <td className="p-2 text-center">{sellerBreakdown.reduce((s, x) => s + x.salesCount, 0)}</td>
                    <td className="p-2 text-right text-green-600">Bs {sellerBreakdown.reduce((s, x) => s + x.totalBs, 0).toFixed(2)}</td>
                    <td className="p-2 text-right">{currency} {sellerBreakdown.reduce((s, x) => s + x.totalUsd, 0).toFixed(2)}</td>
                    <td className="p-2 text-right text-xs">-</td>
                    <td className="p-2 text-center text-xs">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Seller comparison bar chart */}
            {sellerBreakdown.length > 1 && (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sellerBarData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value: any, name: string, props: any) => {
                        if (name === "ventas") return [`${value} ventas`, props.payload.fullName];
                        return [`Bs ${value}`, props.payload.fullName];
                      }}
                    />
                    <Bar yAxisId="left" dataKey="ventas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="totalBs" fill="#16a34a" radius={[4, 4, 0, 0]} opacity={0.7} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ====== DESGLOSE POR ROL ====== */}
      {roleBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Ventas por Rol <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge>
              {roleFilter && <Badge variant="default" className="text-[9px]">Filtrado</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {roleBreakdown.map((role) => {
                const totalAllBs = roleBreakdown.reduce((s, x) => s + x.totalBs, 0);
                const pct = totalAllBs > 0 ? ((role.totalBs / totalAllBs) * 100).toFixed(1) : "0";
                const colorMap: Record<string, string> = { admin: "#8b5cf6", vendedor: "#16a34a", cajero: "#2563eb" };
                const color = colorMap[role.role] || "#6b7280";
                return (
                  <div key={role.role} className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                    roleFilter === role.role ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"
                  }`} onClick={() => setRoleFilter(roleFilter === role.role ? "" : role.role)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm font-semibold">{role.label}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px]">{pct}%</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-[9px] text-muted-foreground">Ventas</p><p className="text-sm font-bold">{role.salesCount}</p></div>
                      <div><p className="text-[9px] text-muted-foreground">Total Bs</p><p className="text-sm font-bold text-green-600">Bs {role.totalBs.toFixed(0)}</p></div>
                      <div><p className="text-[9px] text-muted-foreground">Total $</p><p className="text-sm font-bold">{currency} {role.totalUsd.toFixed(2)}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ====== CHARTS ====== */}
      {sales.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ventas por Hora <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByHour} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value: any, name: string) => [name === "ventas" ? `${value} ventas` : `Bs ${value}`, name === "ventas" ? "Cantidad" : "Total Bs"]} />
                    <Bar yAxisId="left" dataKey="ventas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="totalBs" fill="#16a34a" radius={[4, 4, 0, 0]} opacity={0.7} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribucion por Metodo de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                      label={({ name, pct }: any) => `${name} ${pct}%`}>
                      {paymentPieData.map((_entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value: any, name: string) => [`Bs ${value}`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {Object.entries(paymentBreakdown).map(([method, data]) => {
                  const pct = totalBs > 0 ? ((data.totalBs / totalBs) * 100).toFixed(1) : "0";
                  const barColor = CHART_COLORS[Object.keys(paymentBreakdown).indexOf(method) % CHART_COLORS.length];
                  return (
                    <div key={method} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: barColor }} />
                      <span className="flex-1 truncate">{PAYMENT_LABELS[method] || method}</span>
                      <span className="text-muted-foreground">{data.count} ventas</span>
                      <span className="font-medium w-20 text-right">Bs {data.totalBs.toFixed(0)}</span>
                      <span className="text-muted-foreground w-12 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ====== ENTRADAS AGRUPADAS ====== */}
      {(() => {
        // USD methods (efectivo-usd, zelle, usdt): el totalUsd es el valor real, NO se recalcula con tasa actual
        // Bs methods (efectivo, transferencia, pago-movil, punto-de-venta): totalBs es fijo, totalUsd se calcula con tasa al momento de la venta
        const efectivoFisicoBs_totalBs = (paymentBreakdown["efectivo"]?.totalBs || 0);
        const efectivoFisicoBs_totalUsd = (paymentBreakdown["efectivo"]?.totalUsd || 0);
        const efectivoFisicoUsd_totalUsd = (paymentBreakdown["efectivo-usd"]?.totalUsd || 0);
        const efectivoFisicoUsd_totalBs = (paymentBreakdown["efectivo-usd"]?.totalBs || 0);
        const bsElectronicos_totalBs = (paymentBreakdown["punto-de-venta"]?.totalBs || 0) + (paymentBreakdown["transferencia"]?.totalBs || 0) + (paymentBreakdown["pago-movil"]?.totalBs || 0);
        const bsElectronicos_totalUsd = (paymentBreakdown["punto-de-venta"]?.totalUsd || 0) + (paymentBreakdown["transferencia"]?.totalUsd || 0) + (paymentBreakdown["pago-movil"]?.totalUsd || 0);
        const divisasDigitales_totalUsd = (paymentBreakdown["zelle"]?.totalUsd || 0) + (paymentBreakdown["usdt"]?.totalUsd || 0);
        const divisasDigitales_totalBs = (paymentBreakdown["zelle"]?.totalBs || 0) + (paymentBreakdown["usdt"]?.totalBs || 0);
        const totalEntradasBs = efectivoFisicoBs_totalBs + efectivoFisicoUsd_totalBs + bsElectronicos_totalBs + divisasDigitales_totalBs;
        const totalEntradasUsd = efectivoFisicoBs_totalUsd + efectivoFisicoUsd_totalUsd + bsElectronicos_totalUsd + divisasDigitales_totalUsd;
        return (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-base">&#128176;</span> Entradas Agrupadas por Tipo
                <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* EFECTIVO FISICO Bs */}
                <div className="border-l-4 border-l-green-500 pl-3">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Efectivo Fisico Bs</p>
                  <div className="text-xs flex justify-between bg-green-50/50 rounded px-2 py-1">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold text-green-700">Bs {efectivoFisicoBs_totalBs.toFixed(2)} ({currency} {efectivoFisicoBs_totalUsd.toFixed(2)})</span>
                  </div>
                  <p className="text-right text-xs font-bold text-green-700 mt-1">Subtotal: Bs {efectivoFisicoBs_totalBs.toFixed(2)}</p>
                  <p className="text-right text-[10px] text-green-600">Equivalente: {currency} {efectivoFisicoBs_totalUsd.toFixed(2)}</p>
                </div>

                {/* EFECTIVO FISICO $ */}
                <div className="border-l-4 border-l-green-500 pl-3">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Efectivo Fisico $</p>
                  <div className="text-xs flex justify-between bg-green-50/50 rounded px-2 py-1">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold text-green-700">{currency} {efectivoFisicoUsd_totalUsd.toFixed(2)} (Bs {efectivoFisicoUsd_totalBs.toFixed(2)})</span>
                  </div>
                  <p className="text-right text-xs font-bold text-green-700 mt-1">Subtotal: {currency} {efectivoFisicoUsd_totalUsd.toFixed(2)}</p>
                  <p className="text-right text-[10px] text-green-600">Equivalente: Bs {efectivoFisicoUsd_totalBs.toFixed(2)}</p>
                </div>

                {/* BS ELECTRONICOS */}
                <div className="border-l-4 border-l-blue-500 pl-3">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Bs Electronicos</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between bg-blue-50/50 rounded px-2 py-1">
                      <span className="text-muted-foreground">Punto de Venta</span>
                      <span className="font-semibold text-blue-700">Bs {(paymentBreakdown["punto-de-venta"]?.totalBs || 0).toFixed(2)} <span className="text-muted-foreground">(${(paymentBreakdown["punto-de-venta"]?.totalUsd || 0).toFixed(2)})</span></span>
                    </div>
                    <div className="flex justify-between bg-blue-50/50 rounded px-2 py-1">
                      <span className="text-muted-foreground">Transferencia</span>
                      <span className="font-semibold text-blue-700">Bs {(paymentBreakdown["transferencia"]?.totalBs || 0).toFixed(2)} <span className="text-muted-foreground">(${(paymentBreakdown["transferencia"]?.totalUsd || 0).toFixed(2)})</span></span>
                    </div>
                    <div className="flex justify-between bg-blue-50/50 rounded px-2 py-1">
                      <span className="text-muted-foreground">Pago Movil</span>
                      <span className="font-semibold text-blue-700">Bs {(paymentBreakdown["pago-movil"]?.totalBs || 0).toFixed(2)} <span className="text-muted-foreground">(${(paymentBreakdown["pago-movil"]?.totalUsd || 0).toFixed(2)})</span></span>
                    </div>
                  </div>
                  <div className="text-right text-xs mt-1 space-y-0.5">
                    <p className="font-bold text-blue-700">Subtotal: Bs {bsElectronicos_totalBs.toFixed(2)}</p>
                    <p className="text-blue-600">Equivalente: {currency} {bsElectronicos_totalUsd.toFixed(2)}</p>
                  </div>
                </div>

                {/* DIVISAS DIGITALES */}
                <div className="border-l-4 border-l-purple-500 pl-3">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Divisas Digitales</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between bg-purple-50/50 rounded px-2 py-1">
                      <span className="text-muted-foreground">Zelle</span>
                      <span className="font-semibold text-purple-700">{currency} {(paymentBreakdown["zelle"]?.totalUsd || 0).toFixed(2)} <span className="text-muted-foreground">(Bs {(paymentBreakdown["zelle"]?.totalBs || 0).toFixed(2)})</span></span>
                    </div>
                    <div className="flex justify-between bg-purple-50/50 rounded px-2 py-1">
                      <span className="text-muted-foreground">USDT</span>
                      <span className="font-semibold text-purple-700">{currency} {(paymentBreakdown["usdt"]?.totalUsd || 0).toFixed(2)} <span className="text-muted-foreground">(Bs {(paymentBreakdown["usdt"]?.totalBs || 0).toFixed(2)})</span></span>
                    </div>
                  </div>
                  <div className="text-right text-xs mt-1 space-y-0.5">
                    <p className="font-bold text-purple-700">Subtotal: {currency} {divisasDigitales_totalUsd.toFixed(2)}</p>
                    <p className="text-purple-600">Equivalente: Bs {divisasDigitales_totalBs.toFixed(2)}</p>
                  </div>
                </div>

                {/* TOTAL - EXPLICITO PARA CONTEO FISICO Y COTEJO */}
                <div className="border-2 border-amber-500 rounded-lg pl-3 bg-amber-50/80 py-2 space-y-1.5">
                  <p className="text-sm font-black text-amber-900 uppercase tracking-wide">Resumen para Arqueo y Cotejo</p>
                  <Separator className="my-1" />
                  {/* DOLARES: lo que el admin debe contar/cotejar en USD */}
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-green-800 uppercase tracking-wider">Dolares (Efectivo $ + Zelle + USDT):</p>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <span className="text-muted-foreground">Efectivo $:</span>
                      <span className="text-right font-semibold">{currency} {efectivoFisicoUsd_totalUsd.toFixed(2)}</span>
                      <span className="text-right text-muted-foreground">(contar billetes)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <span className="text-muted-foreground">Zelle:</span>
                      <span className="text-right font-semibold">{currency} {(paymentBreakdown["zelle"]?.totalUsd || 0).toFixed(2)}</span>
                      <span className="text-right text-muted-foreground">(ver app)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <span className="text-muted-foreground">USDT:</span>
                      <span className="text-right font-semibold">{currency} {(paymentBreakdown["usdt"]?.totalUsd || 0).toFixed(2)}</span>
                      <span className="text-right text-muted-foreground">(ver wallet)</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs bg-green-100/60 rounded px-2 py-1">
                    <span className="font-black text-green-900">TOTAL USD:</span>
                    <span className="font-black text-green-900">{currency} {totalEntradasUsd.toFixed(2)}</span>
                  </div>
                  <Separator className="my-1" />
                  {/* BOLIVARES: lo que el admin debe contar/cotejar en Bs */}
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Bolivares (Efectivo Bs + Transferencia + Pago Movil + Punto de Venta):</p>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <span className="text-muted-foreground">Efectivo Bs:</span>
                      <span className="text-right font-semibold">Bs {efectivoFisicoBs_totalBs.toFixed(2)}</span>
                      <span className="text-right text-muted-foreground">(contar billetes)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <span className="text-muted-foreground">Punto de Venta:</span>
                      <span className="text-right font-semibold">Bs {(paymentBreakdown["punto-de-venta"]?.totalBs || 0).toFixed(2)}</span>
                      <span className="text-right text-muted-foreground">(ver terminal)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <span className="text-muted-foreground">Transferencia:</span>
                      <span className="text-right font-semibold">Bs {(paymentBreakdown["transferencia"]?.totalBs || 0).toFixed(2)}</span>
                      <span className="text-right text-muted-foreground">(ver banco)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <span className="text-muted-foreground">Pago Movil:</span>
                      <span className="text-right font-semibold">Bs {(paymentBreakdown["pago-movil"]?.totalBs || 0).toFixed(2)}</span>
                      <span className="text-right text-muted-foreground">(ver banco)</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs bg-blue-100/60 rounded px-2 py-1">
                    <span className="font-black text-blue-900">TOTAL BS:</span>
                    <span className="font-black text-blue-900">Bs {totalEntradasBs.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ====== REFERENCIAS ====== */}
      {referenceDetails.length > 0 && (() => {
        const bsRefs = referenceDetails.filter(r => r.paymentType === 'Transferencia' || r.paymentType === 'Pago Movil');
        const usdRefs = referenceDetails.filter(r => r.paymentType === 'Zelle' || r.paymentType === 'USDT');
        return (<>
          {/* BS ELECTRONICOS */}
          {bsRefs.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                  Bs Electronicos — Transferencia + Pago Movil
                  <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  <div className="p-2 rounded bg-blue-100/50 text-center">
                    <p className="text-[10px] text-muted-foreground">Transferencias</p>
                    <p className="text-sm font-bold text-blue-700">{referenceDetails.filter(r => r.paymentType === 'Transferencia').length} ops</p>
                    <p className="text-xs font-semibold text-blue-600">Bs {transferTotal.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-cyan-100/50 text-center">
                    <p className="text-[10px] text-muted-foreground">Pago Movil</p>
                    <p className="text-sm font-bold text-cyan-700">{referenceDetails.filter(r => r.paymentType === 'Pago Movil').length} ops</p>
                    <p className="text-xs font-semibold text-cyan-600">Bs {mobileTotal.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-blue-200/50 text-center col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-muted-foreground">Total Bs Electronicos</p>
                    <p className="text-sm font-bold text-blue-800">{bsRefs.length} ops</p>
                    <p className="text-xs font-semibold text-blue-700">Bs {(transferTotal + mobileTotal).toFixed(2)}</p>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-blue-100/70 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Fecha/Hora</th>
                        <th className="text-left p-2 font-medium">Cliente</th>
                        <th className="text-left p-2 font-medium">Tipo</th>
                        <th className="text-left p-2 font-medium">Referencia</th>
                        <th className="text-right p-2 font-medium">Monto (Bs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bsRefs.map((ref, idx) => (
                        <tr key={`bs-${ref.saleId}-${idx}`} className="border-t hover:bg-blue-50/50">
                          <td className="p-2 text-[11px]">{ref.saleTime}</td>
                          <td className="p-2 text-[11px]">{ref.customerName}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={`text-[9px] ${ref.paymentType === 'Transferencia' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-cyan-100 text-cyan-700 border-cyan-200'}`}>
                              {ref.paymentType}
                            </Badge>
                          </td>
                          <td className="p-2 font-mono text-[11px] font-semibold tracking-wide">{ref.reference}</td>
                          <td className="p-2 text-right font-bold text-blue-600">Bs {ref.totalBs.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* USD ELECTRONICOS */}
          {usdRefs.length > 0 && (
            <Card className="border-purple-200 bg-purple-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-purple-500" />
                  USD Electronicos — Zelle + USDT
                  <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  <div className="p-2 rounded bg-purple-100/50 text-center">
                    <p className="text-[10px] text-muted-foreground">Zelle</p>
                    <p className="text-sm font-bold text-purple-700">{referenceDetails.filter(r => r.paymentType === 'Zelle').length} ops</p>
                    <p className="text-xs font-semibold text-purple-600">${zelleTotalUsd.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-fuchsia-100/50 text-center">
                    <p className="text-[10px] text-muted-foreground">USDT</p>
                    <p className="text-sm font-bold text-fuchsia-700">{referenceDetails.filter(r => r.paymentType === 'USDT').length} ops</p>
                    <p className="text-xs font-semibold text-fuchsia-600">${usdtTotalUsd.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-purple-200/50 text-center col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-muted-foreground">Total USD Electronicos</p>
                    <p className="text-sm font-bold text-purple-800">{usdRefs.length} ops</p>
                    <p className="text-xs font-semibold text-purple-700">${(zelleTotalUsd + usdtTotalUsd).toFixed(2)}</p>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-purple-100/70 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Fecha/Hora</th>
                        <th className="text-left p-2 font-medium">Cliente</th>
                        <th className="text-left p-2 font-medium">Tipo</th>
                        <th className="text-left p-2 font-medium">Referencia</th>
                        <th className="text-right p-2 font-medium">Monto ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usdRefs.map((ref, idx) => (
                        <tr key={`usd-${ref.saleId}-${idx}`} className="border-t hover:bg-purple-50/50">
                          <td className="p-2 text-[11px]">{ref.saleTime}</td>
                          <td className="p-2 text-[11px]">{ref.customerName}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={`text-[9px] ${ref.paymentType === 'Zelle' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200'}`}>
                              {ref.paymentType}
                            </Badge>
                          </td>
                          <td className="p-2 font-mono text-[11px] font-semibold tracking-wide">{ref.reference}</td>
                          <td className="p-2 text-right font-bold text-purple-600">${ref.totalUsd.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>);
      })()}

      {/* ====== PRODUCTOS + PAGO BAR ====== */}
      {sales.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Comparativa Metodos de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentBarData} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value: any, name: string) => [name === "cantidad" ? `${value}` : `Bs ${value}`, name === "cantidad" ? "Ventas" : "Total Bs"]} />
                    <Bar dataKey="totalBs" radius={[0, 4, 4, 0]}>
                      {paymentBarData.map((_entry, index) => (<Cell key={`bar-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Productos Mas Vendidos <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge></CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-48 overflow-y-auto">
                {topProducts.map((product, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border-b last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-sm truncate">{product.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-xs font-medium">{product.quantity} u</span>
                      <span className="text-[10px] text-muted-foreground ml-1">Bs {(product.total * bcvRate).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Sin datos</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ====== TABLA DE VENTAS ====== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Ventas del Periodo ({salesCount}) <Badge variant="secondary" className="text-[9px]">{periodLabel}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={sales.length === 0} className="text-xs">
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportXlsx} disabled={sales.length === 0} className="text-xs">
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf} disabled={sales.length === 0} className="text-xs">
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={printReport} disabled={sales.length === 0} className="text-xs">
                Imprimir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Fecha</th>
                  <th className="text-left p-2 font-medium">Vendedor</th>
                  <th className="text-left p-2 font-medium">Cliente</th>
                  <th className="text-left p-2 font-medium">Metodo</th>
                  <th className="text-left p-2 font-medium">Referencia</th>
                  <th className="text-right p-2 font-medium">Total Bs</th>
                  <th className="text-right p-2 font-medium">Total $</th>
                  <th className="text-center p-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const isCreditRow = (sale as any).isCredit === true;
                  const showRef = !isCreditRow && ["transferencia", "pago-movil", "zelle", "usdt"].includes(sale.paymentMethod);
                  const isMixto = !isCreditRow && sale.paymentMethod === "mixto";
                  const saleAny = sale as any;
                  let mixedRefs = "";
                  if (isMixto && saleAny.mixedPaymentJson) {
                    try {
                      const entries = JSON.parse(saleAny.mixedPaymentJson);
                      const refEntries = entries.filter((e: any) => (e.method === "transferencia" || e.method === "pago-movil" || e.method === "zelle" || e.method === "usdt") && e.reference);
                      if (refEntries.length > 0) {
                        mixedRefs = refEntries.map((e: any) => `${e.method === "transferencia" ? "Transf" : "PM"}: ${e.reference} (Bs ${parseFloat(e.amountBs).toFixed(2)})`).join(" | ");
                      }
                    } catch {}
                  }
                  return (
                    <tr key={sale.id} className="border-t hover:bg-muted/30">
                      <td className="p-2 text-xs">
                        {new Date(sale.date).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-2 text-xs font-medium">
                        {sale.sellerName ? <Badge variant="outline" className="text-[10px] font-medium">{sale.sellerName}</Badge> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="p-2 text-xs">{sale.customerName || "Cliente Final"}</td>
                      <td className="p-2 text-xs"><Badge variant={isCreditRow ? "secondary" : "outline"} className={isCreditRow ? "bg-amber-100 text-amber-800 text-[10px]" : "text-[10px]"}>{isCreditRow ? "Credito" : (PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod)}</Badge></td>
                      <td className="p-2 text-xs font-mono">
                        {showRef ? (saleAny.referenceNumber || "-") : (mixedRefs || "-")}
                      </td>
                      <td className="p-2 text-right font-bold text-green-600">Bs {sale.totalBs.toFixed(2)}</td>
                      <td className="p-2 text-right font-medium">{currency} {sale.total.toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <button onClick={() => reprintReceipt(sale)} className="text-blue-600 hover:text-blue-800 hover:underline text-[10px] font-medium" title="Reimprimir factura">Reimprimir</button>
                      </td>
                    </tr>
                  );
                })}
                {sales.length === 0 && (
                  <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">
                    {loading ? "Cargando..." : "No hay ventas en el periodo seleccionado"}
                  </td></tr>
                )}
                {sales.length > 0 && (
                  <>
                    <tr className="border-t-2 bg-emerald-50/50 font-bold">
                      <td colSpan={6} className="p-2 text-right text-sm text-emerald-700">VENTAS BRUTAS ({salesCount} ventas - incluye Cashea y Credito)</td>
                      <td className="p-2 text-right text-emerald-700">Bs {grossTotalBs.toFixed(2)}</td>
                      <td className="p-2 text-right text-emerald-700">{currency} {grossTotalSales.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-green-50/70 font-bold">
                      <td colSpan={6} className="p-2 text-right text-sm text-green-700">ENTRADAS NETAS (sin Cashea ni Credito - entra a caja)</td>
                      <td className="p-2 text-right text-green-700">Bs {totalBs.toFixed(2)}</td>
                      <td className="p-2 text-right text-green-700">{currency} {totalSales.toFixed(2)}</td>
                    </tr>
                    {casheaSalesCount > 0 && (
                      <tr className="bg-purple-50/70 font-bold">
                        <td colSpan={6} className="p-2 text-right text-sm text-purple-700">&#128241; CASHEA (BNPL - se cobra despues desde la app)</td>
                        <td className="p-2 text-right text-purple-700">Bs {casheaSalesTotalBs.toFixed(2)}</td>
                        <td className="p-2 text-right text-purple-700">{currency} {casheaSalesTotal.toFixed(2)}</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
