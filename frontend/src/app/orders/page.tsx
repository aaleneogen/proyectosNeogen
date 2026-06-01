"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FileText, Download } from "lucide-react";
import { ordersApi } from "@/lib/api";
import { cn, statusBadge, formatDate } from "@/lib/utils";

export default function OrdersPage() {
  const router = useRouter();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Historial de órdenes</h1>
        <p className="text-gray-500 mt-1">{orders.length} órdenes procesadas</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Archivo</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Distribuidor</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Líneas</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Sin órdenes</td></tr>
            ) : orders.map((order) => {
              const badge = statusBadge(order.status);
              return (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/review/${order.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-900 truncate max-w-xs">{order.original_filename}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{order.distributor}</td>
                  <td className="px-6 py-4 text-center text-gray-700 font-medium">{order.line_count}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(order.created_at)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", badge.className)}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    {order.status === "completed" && (
                      <button
                        onClick={() => ordersApi.export(order.id)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-brand-600"
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
