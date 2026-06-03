"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { cn, formatCurrency, formatMonth } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

export default function ReportsPage() {
  return <AppShell><ReportsContent /></AppShell>;
}

function ReportsContent() {
  const { data: report, isLoading } = useQuery({
    queryKey: ["report-summary"],
    queryFn: reportsApi.summary,
  });

  if (isLoading) return <div className="p-8 text-gray-400">Cargando reportes...</div>;
  if (!report) return null;

  const pieData = [
    { name: "Completados", value: report.completed_orders },
    { name: "Abiertos", value: report.open_orders },
  ].filter((d) => d.value > 0);

  const lineStatusData = [
    { name: "Pendientes", value: report.pending_lines, fill: "#f59e0b" },
    { name: "Parciales", value: report.partial_lines, fill: "#f97316" },
    { name: "Completadas", value: report.completed_lines, fill: "#10b981" },
  ];

  const monthlyFormatted = report.monthly_orders.map((m) => ({
    ...m,
    label: formatMonth(m.month),
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reportes y KPIs</h1>
        <p className="text-gray-500 mt-1">Métricas del portal de pedidos Neogen · ELECO</p>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total pedidos" value={report.total_orders} sub="Histórico" />
        <KpiCard label="Monto total" value={formatCurrency(report.total_amount)} sub="En pedidos" color="blue" />
        <KpiCard label="Monto entregado" value={formatCurrency(report.delivered_amount)} sub={`${report.total_amount > 0 ? Math.round((report.delivered_amount / report.total_amount) * 100) : 0}% del total`} color="green" />
        <KpiCard
          label="Pendiente entregar"
          value={formatCurrency(report.total_amount - report.delivered_amount)}
          sub={`${report.pending_lines + report.partial_lines} líneas`}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Orders by month */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Pedidos por mes</h3>
          {monthlyFormatted.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyFormatted}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie: pedidos abiertos vs completados */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Estado de pedidos</h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={["#10b981", "#3b82f6"][i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-xs mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: ["#10b981", "#3b82f6"][i] }} />
                    <span className="text-gray-600">{d.name}: <strong>{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monto por mes */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Monto facturado por mes (USD)</h3>
          {monthlyFormatted.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyFormatted}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Monto USD" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lines status donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Estado de líneas</h3>
          <div className="space-y-3">
            {lineStatusData.map((d) => {
              const pct = report.total_lines > 0 ? Math.round((d.value / report.total_lines) * 100) : 0;
              return (
                <div key={d.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{d.name}</span>
                    <span className="font-semibold text-gray-900">{d.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.fill }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top products */}
      {report.top_products.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top productos más pedidos</h3>
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">SKU</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                  <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase">Pedidos</th>
                  <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase">Cant. total</th>
                  <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase">Entregado</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">% entrega</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.top_products.map((p, i) => {
                  const deliveredPct = p.total_ordered > 0 ? Math.round((p.total_delivered / p.total_ordered) * 100) : 0;
                  return (
                    <tr key={p.sku} className="hover:bg-gray-50">
                      <td className="py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-3"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{p.sku}</span></td>
                      <td className="py-3 text-gray-700 max-w-xs truncate">{p.description}</td>
                      <td className="py-3 text-center text-gray-700 font-medium">{p.times_ordered}</td>
                      <td className="py-3 text-center text-gray-700">{p.total_ordered}</td>
                      <td className="py-3 text-center text-emerald-700 font-medium">{p.total_delivered}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${deliveredPct}%` }} />
                          </div>
                          <span className={cn("text-xs font-medium", deliveredPct === 100 ? "text-emerald-600" : "text-gray-500")}>
                            {deliveredPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color = "gray" }: { label: string; value: any; sub: string; color?: string }) {
  const colors: Record<string, string> = {
    gray: "text-gray-900", blue: "text-blue-700", green: "text-emerald-700", amber: "text-amber-700"
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={cn("text-xl font-bold", colors[color])}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
