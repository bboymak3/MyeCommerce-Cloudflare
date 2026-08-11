"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authFetch } from "@/lib/auth-fetch";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";

interface DashboardProps {
  bcvRate: number;
  currency: string;
}

interface DashboardData {
  today: {
    grossUsd: number;
    grossBs: number;
    totalUsd: number;   // entradas netas (sin cashea ni credito)
    totalBs: number;
    count: number;
    avgTicket: number;
    creditCount: number;
    creditUsd: number;
    casheaCount: number;
    casheaUsd: number;
    casheaBs: number;
  };
  yesterday: { totalUsd: number; count: number };
  pctChange: number;
  weekDays: { label: string; total: number; count: number; cashea: number; casheaCount: number }[];
  topProducts: { name: string; qty: number; total: number }[];
  paymentBreakdown: Record<string, { count: number; totalUsd: number; totalBs: number }>;
  recentSales: {
    id: string; time: string; customer: string;
    total: number; totalBs: number; method: string;
    isCredit: boolean; isCashea?: boolean; itemCount: number;
  }[];
  lastUpdate: string;
}

const METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  'efectivo-usd': "Efectivo $",
  tarjeta: "Tarjeta",
  cashea: "Cashea",
  transferencia: "Transferencia",
  'pago-movil': "Pago Movil",
  'punto-de-venta': "Punto de Venta",
  cheque: "Cheque",
  mixto: "Mixto",
};

export default function DashboardTab({ bcvRate, currency }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await authFetch("/api/dashboard");
      const json = await res.json();
      if (!json.error) setData(json);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Auto-refresh cada 60 segundos
  useEffect(() => {
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground animate-pulse">Cargando dashboard...</p>
      </div>
    );
  }

  const { today, pctChange, weekDays, topProducts, paymentBreakdown, recentSales } = data;

  // Datos para grafico apilado: entradas netas + cashea
  const stackedWeekData = weekDays.map(d => ({
    label: d.label,
    netas: parseFloat(d.total.toFixed(2)),
    cashea: parseFloat(d.cashea.toFixed(2)),
  }));

  return (
    <div className="space-y-4">
      {/* Header con refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("es-VE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboard}>
          Actualizar
        </Button>
      </div>

      {/* ===== KPIs del dia ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Ventas Hoy (count) */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Ventas Hoy</p>
            <p className="text-2xl font-black text-blue-600">{today.count}</p>
            <p className="text-[10px] text-muted-foreground">
              {pctChange >= 0 ? (
                <span className="text-green-600">+{pctChange.toFixed(1)}%</span>
              ) : (
                <span className="text-red-500">{pctChange.toFixed(1)}%</span>
              )}
              {" vs ayer ("}{data.yesterday.count} ventas)
            </p>
          </CardContent>
        </Card>

        {/* Ventas Brutas (incluye TODO: cashea, credito, efectivo) */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Ventas Brutas</p>
            <p className="text-2xl font-black text-emerald-600">${today.grossUsd.toFixed(2)}</p>
            <p className="text-sm font-medium text-muted-foreground">Bs {today.grossBs.toFixed(2)}</p>
          </CardContent>
        </Card>

        {/* Entradas Netas (efectivo en caja - SIN cashea ni credito) */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Entradas Netas (Caja)</p>
            <p className="text-2xl font-black text-green-600">${today.totalUsd.toFixed(2)}</p>
            <p className="text-sm font-medium text-muted-foreground">Bs {today.totalBs.toFixed(2)}</p>
          </CardContent>
        </Card>

        {/* Cashea (BNPL - se cobra despues) */}
        <Card className={`border-l-4 border-l-purple-500 ${today.casheaCount > 0 ? 'bg-purple-50/40' : ''}`}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Cashea (BNPL)</p>
            <p className="text-2xl font-black text-purple-600">{today.casheaCount}</p>
            <p className="text-sm font-medium text-muted-foreground">
              ${today.casheaUsd.toFixed(2)} <span className="text-[9px]">/ Bs {today.casheaBs.toFixed(2)}</span>
            </p>
          </CardContent>
        </Card>

        {/* Creditos Hoy */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Creditos Hoy</p>
            <p className="text-2xl font-black text-amber-600">{today.creditCount}</p>
            <p className="text-sm font-medium text-muted-foreground">${today.creditUsd.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Aclaracion Cashea ===== */}
      {today.casheaCount > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-md p-2 text-xs text-purple-800 flex items-start gap-2">
          <span className="text-base flex-shrink-0">&#128241;</span>
          <div>
            <strong>Cashea (Compra Ahora, Paga Despues):</strong> {today.casheaCount} venta(s) por ${today.casheaUsd.toFixed(2)} / Bs {today.casheaBs.toFixed(2)}.
            Este dinero NO entra a caja hoy porque Cashea lo transfiere despues desde la app. Ya esta contado en <strong>Ventas Brutas</strong> pero excluido de <strong>Entradas Netas</strong>.
          </div>
        </div>
      )}

      {/* ===== Grafico semanal + Top productos ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Grafico apilado: entradas netas + cashea */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ventas de la Semana (USD)</CardTitle>
            <p className="text-[10px] text-muted-foreground">Verde = Entradas Netas (caja) | Morado = Cashea (BNPL, se cobra despues)</p>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedWeekData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const label = name === 'cashea' ? 'Cashea (BNPL)' : 'Entradas Netas';
                      return [`$${value.toFixed(2)}`, label];
                    }}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => value === 'cashea' ? 'Cashea (BNPL)' : 'Entradas Netas'} />
                  <Bar dataKey="netas" stackId="a" name="netas" fill="#22c55e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="cashea" stackId="a" name="cashea" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top productos */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mas Vendidos Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin ventas hoy</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <span className="text-sm font-medium truncate">{p.name}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold">${p.total.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{p.qty} uds</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Metodos de pago + Ultimas ventas ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Metodos de pago */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Metodos de Pago Hoy</CardTitle>
            <p className="text-[10px] text-muted-foreground">Incluye Cashea como metodo de venta (BNPL)</p>
          </CardHeader>
          <CardContent>
            {Object.keys(paymentBreakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin ventas hoy</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const effBs = paymentBreakdown["efectivo"] || { count: 0, totalUsd: 0, totalBs: 0 };
                  const effUsd = paymentBreakdown["efectivo-usd"] || { count: 0, totalUsd: 0, totalBs: 0 };
                  const pdv = paymentBreakdown["punto-de-venta"] || { count: 0, totalUsd: 0, totalBs: 0 };
                  const transf = paymentBreakdown["transferencia"] || { count: 0, totalUsd: 0, totalBs: 0 };
                  const pm = paymentBreakdown["pago-movil"] || { count: 0, totalUsd: 0, totalBs: 0 };
                  const zelle = paymentBreakdown["zelle"] || { count: 0, totalUsd: 0, totalBs: 0 };
                  const usdt = paymentBreakdown["usdt"] || { count: 0, totalUsd: 0, totalBs: 0 };
                  const totalUsdMethods = effUsd.totalUsd + zelle.totalUsd + usdt.totalUsd;
                  const totalBsMethods = effBs.totalBs + pdv.totalBs + transf.totalBs + pm.totalBs;
                  return (
                    <>
                      {Object.entries(paymentBreakdown)
                        .sort((a, b) => b[1].totalUsd - a[1].totalUsd)
                        .map(([method, info]) => (
                          <div key={method} className={`flex items-center justify-between py-1 ${method === 'cashea' ? 'bg-purple-50/60 -mx-1 px-1 rounded' : ''}`}>
                            <span className="text-sm flex items-center gap-1">
                              {method === 'cashea' && <span className="text-xs">&#128241;</span>}
                              {METHOD_LABELS[method] || method}
                              {method === 'cashea' && <Badge variant="outline" className="text-[8px] text-purple-700 border-purple-300">BNPL</Badge>}
                            </span>
                            <div className="text-right">
                              <span className="text-sm font-bold">${info.totalUsd.toFixed(2)}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">({info.count})</span>
                            </div>
                          </div>
                        ))}
                      <Separator />
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-bold">TOTAL BRUTO</span>
                        <span className="text-sm font-black">${today.grossUsd.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Entradas Netas (sin Cashea/Credito)</span>
                        <span className="font-bold text-green-700">${today.totalUsd.toFixed(2)}</span>
                      </div>
                      {/* ===== RESUMEN EXPLICITO PARA ARQUEO ===== */}
                      {(totalUsdMethods > 0 || totalBsMethods > 0) && (
                        <div className="border-2 border-amber-400 rounded-lg p-2 bg-amber-50/80 space-y-1.5 mt-2">
                          <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider">Resumen para Arqueo</p>
                          {/* DOLARES: USD electronico (Zelle+USDT) + Efectivo $ */}
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold text-green-800 uppercase tracking-wide">Dolares (USD electronico + Efectivo $):</p>
                            {effUsd.totalUsd > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Efectivo $ (contar):</span><span className="text-right font-semibold">${effUsd.totalUsd.toFixed(2)}</span></div>}
                            {zelle.totalUsd > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Zelle (ver app):</span><span className="text-right font-semibold">${zelle.totalUsd.toFixed(2)}</span></div>}
                            {usdt.totalUsd > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">USDT (ver wallet):</span><span className="text-right font-semibold">${usdt.totalUsd.toFixed(2)}</span></div>}
                            <div className="flex justify-between text-[10px] bg-green-100/60 rounded px-1.5 py-0.5">
                              <span className="font-black text-green-900">TOTAL USD:</span>
                              <span className="font-black text-green-900">${totalUsdMethods.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="border-t border-dashed border-amber-300" />
                          {/* BOLIVARES: Bs electronicos (PdV+Transf+PM) + Efectivo Bs */}
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold text-blue-800 uppercase tracking-wide">Bolivares (Bs electronicos + Efectivo Bs):</p>
                            {effBs.totalBs > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Efectivo Bs (contar):</span><span className="text-right font-semibold">Bs {effBs.totalBs.toFixed(2)}</span></div>}
                            {pdv.totalBs > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Punto Venta (ver terminal):</span><span className="text-right font-semibold">Bs {pdv.totalBs.toFixed(2)}</span></div>}
                            {transf.totalBs > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Transferencia (ver banco):</span><span className="text-right font-semibold">Bs {transf.totalBs.toFixed(2)}</span></div>}
                            {pm.totalBs > 0 && <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-muted-foreground">Pago Movil (ver banco):</span><span className="text-right font-semibold">Bs {pm.totalBs.toFixed(2)}</span></div>}
                            <div className="flex justify-between text-[10px] bg-blue-100/60 rounded px-1.5 py-0.5">
                              <span className="font-black text-blue-900">TOTAL BS:</span>
                              <span className="font-black text-blue-900">Bs {totalBsMethods.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ultimas ventas */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ultimas Ventas de Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin ventas hoy</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-1.5 px-1">Hora</th>
                      <th className="text-left py-1.5 px-1">Cliente</th>
                      <th className="text-right py-1.5 px-1">Total $</th>
                      <th className="text-right py-1.5 px-1">Total Bs</th>
                      <th className="text-center py-1.5 px-1">Metodo</th>
                      <th className="text-center py-1.5 px-1">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale) => (
                      <tr key={sale.id} className={`border-b last:border-0 hover:bg-muted/30 ${
                        sale.isCredit ? 'bg-amber-50/50' : sale.isCashea ? 'bg-purple-50/50' : ''
                      }`}>
                        <td className="py-1.5 px-1 font-mono">{sale.time}</td>
                        <td className="py-1.5 px-1 truncate max-w-[120px]">
                          {sale.customer}
                        </td>
                        <td className="py-1.5 px-1 text-right font-bold">${sale.total.toFixed(2)}</td>
                        <td className="py-1.5 px-1 text-right">{sale.totalBs.toFixed(2)}</td>
                        <td className="py-1.5 px-1 text-center">
                          {sale.isCredit ? (
                            <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-400">CREDITO</Badge>
                          ) : sale.isCashea ? (
                            <Badge className="text-[9px] bg-purple-100 text-purple-700 border-purple-400">CASHEA</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px]">{METHOD_LABELS[sale.method] || sale.method}</Badge>
                          )}
                        </td>
                        <td className="py-1.5 px-1 text-center">{sale.itemCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
