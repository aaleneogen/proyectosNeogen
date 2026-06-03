"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Truck, Package } from "lucide-react";
import { ordersApi } from "@/lib/api";
import { cn, lineStatusBadge, orderStatusBadge, formatDate, formatCurrency } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";

export default function DeliveriesPage() {
  return <AppShell><DeliveriesContent /></AppShell>;
}

function DeliveriesContent() {
  const router = useRouter();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["orders"], queryFn: ordersApi.list });

  // Filter to orders with at least something going on
  const activeOrders = orders.filter(
    (o) => o.status === "approved" || o.status === "review" || o.status === "completed"
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Entregas</h1>
        <p className="text-gray-500 mt-1">Seguimiento de entregas por pedido</p>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Cargando...</div>
      ) : activeOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay pedidos activos con entregas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeOrders.map((order) => (
            <OrderDeliveryCard
              key={order.id}
              order={order}
              onClick={() => router.push(`/review/${order.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderDeliveryCard({ order, onClick }: any) {
  const statusBadge = orderStatusBadge(order.status);
  const pendingCount = order.lines_pending ?? 0;
  const completedCount = order.lines_completed ?? 0;
  const total = order.line_count ?? 0;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all text-left"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {order.order_number && <span className="text-blue-600 mr-2">{order.order_number}</span>}
              {order.original_filename}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.created_at)}</p>
          </div>
        </div>
        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", statusBadge.className)}>
          {statusBadge.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Progreso de entrega</span>
          <span className="font-medium">{completedCount}/{total} líneas completadas ({pct}%)</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex gap-4 text-xs">
        <span className="text-amber-600 font-medium">🟡 {pendingCount} pendientes</span>
        <span className="text-emerald-600 font-medium">🟢 {completedCount} completas</span>
        <span className="text-gray-500">{total} total</span>
      </div>
    </button>
  );
}
