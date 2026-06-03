"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FileText, Download } from "lucide-react";
import { ordersApi } from "@/lib/api";
import { cn, orderStatusBadge, lineStatusBadge, formatDate } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";

export default function OrdersPage() {
  return <AppShell><OrdersContent /></AppShell>;
}

function OrdersContent() {
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["orders"], queryFn: ordersApi.list });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-gray-500 mt-1">{orders.length} órdenes de compra</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Nro. Pedido</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Archivo</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Líneas</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Completas</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Sin pedidos</td></tr>
            ) : orders.map((order) => {
              const badge = orderStatusBadge(order.status);
              const pct = order.line_count > 0
                ? Math.round((order.lines_completed / order.line_count) * 100)
                : 0;
              return (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/review/${order.id}`)}
                >
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm font-semibold text-blue-600">
                      {order.order_number || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-700 truncate max-w-xs">{order.original_filename}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center font-medium text-gray-700">{order.line_count}</td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(order.created_at)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", badge.className)}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {isAdmin() && order.status === "completed" && (
                      <button
                        onClick={() => ordersApi.export(order.id, order.order_number)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600"
                        title="Descargar Excel"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
