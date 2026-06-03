"use client";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, CheckCircle2, Clock, Loader2,
  AlertCircle, TrendingUp, Package, Truck, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { ordersApi, reportsApi, OrderSummary } from "@/lib/api";
import { cn, orderStatusBadge, formatDate, formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { AppShell } from "@/components/layout/AppShell";

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuthStore();

  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: ordersApi.list, refetchInterval: 10_000 });
  const { data: report } = useQuery({ queryKey: ["report-summary"], queryFn: reportsApi.summary });

  const uploadMutation = useMutation({
    mutationFn: ordersApi.upload,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Orden procesada · ${result.lines_detected} líneas detectadas`);
      router.push(`/review/${result.order_id}`);
    },
    onError: (error: any) => toast.error(error?.response?.data?.detail || "Error al procesar el archivo"),
  });

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) uploadMutation.mutate(files[0]);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    disabled: uploadMutation.isPending,
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {isAdmin() ? "Vista general del portal Neogen · ELECO" : "Tus pedidos y estado de entregas"}
        </p>
      </div>

      {/* KPI Cards */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard icon={FileText} label="Pedidos abiertos" value={report.open_orders} color="blue" />
          <KpiCard icon={CheckCircle2} label="Completados" value={report.completed_orders} color="green" />
          <KpiCard icon={Package} label="Líneas pendientes" value={report.pending_lines} color="amber" />
          <KpiCard
            icon={DollarSign}
            label="Monto total"
            value={formatCurrency(report.total_amount)}
            color="indigo"
            isText
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload zone */}
        <div className="lg:col-span-1">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all h-full min-h-[200px] flex flex-col items-center justify-center",
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
              uploadMutation.isPending && "opacity-60 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-sm font-medium text-gray-600">Procesando OC...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Upload className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">
                    {isDragActive ? "Soltá aquí" : "Subir orden de compra"}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">PDF · XLSX · XLS · CSV</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pedidos recientes</h2>
            <button
              onClick={() => router.push("/orders")}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todos →
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay pedidos todavía
              </div>
            ) : (
              orders.slice(0, 6).map((order) => (
                <OrderRow key={order.id} order={order} onClick={() => router.push(`/review/${order.id}`)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Progress section for admin */}
      {isAdmin() && report && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Estado de entregas</h2>
          <div className="grid grid-cols-3 gap-6">
            <DeliveryProgress label="Pendientes" value={report.pending_lines} total={report.total_lines} color="bg-yellow-400" />
            <DeliveryProgress label="Parciales" value={report.partial_lines} total={report.total_lines} color="bg-orange-400" />
            <DeliveryProgress label="Completadas" value={report.completed_lines} total={report.total_lines} color="bg-emerald-400" />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
            <div>
              <span className="text-gray-500">Monto entregado: </span>
              <span className="font-semibold text-gray-900">{formatCurrency(report.delivered_amount)}</span>
            </div>
            <div>
              <span className="text-gray-500">Pendiente de entrega: </span>
              <span className="font-semibold text-amber-600">
                {formatCurrency(report.total_amount - report.delivered_amount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, isText }: {
  icon: any; label: string; value: any; color: string; isText?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600", indigo: "bg-indigo-50 text-indigo-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colors[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={cn("font-bold text-gray-900", isText ? "text-xl" : "text-3xl")}>{value}</p>
    </div>
  );
}

function DeliveryProgress({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-900 font-bold">{value} <span className="text-gray-400 font-normal">/ {total}</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">{pct}%</p>
    </div>
  );
}

function OrderRow({ order, onClick }: { order: OrderSummary; onClick: () => void }) {
  const badge = orderStatusBadge(order.status);
  return (
    <button
      onClick={onClick}
      className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
            {order.order_number && <span className="text-blue-600 mr-2">{order.order_number}</span>}
            {order.original_filename}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(order.created_at)} · {order.line_count} líneas
          </p>
        </div>
      </div>
      <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium shrink-0", badge.className)}>
        {badge.label}
      </span>
    </button>
  );
}
