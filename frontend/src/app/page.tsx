"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ordersApi, OrderSummary } from "@/lib/api";
import { cn, statusBadge, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: ordersApi.upload,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Orden procesada: ${result.lines_detected} líneas detectadas`);
      router.push(`/review/${result.order_id}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Error al procesar el archivo");
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) uploadMutation.mutate(file);
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

  const stats = {
    total: orders.length,
    completed: orders.filter((o) => o.status === "completed").length,
    review: orders.filter((o) => o.status === "review").length,
    error: orders.filter((o) => o.status === "error").length,
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Convierte órdenes de compra ELECO al formato SAP Business One</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total órdenes", value: stats.total, icon: FileText, color: "text-blue-600" },
          { label: "Completadas", value: stats.completed, icon: CheckCircle2, color: "text-green-600" },
          { label: "En revisión", value: stats.review, icon: Clock, color: "text-yellow-600" },
          { label: "Con errores", value: stats.error, icon: AlertCircle, color: "text-red-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <Icon className={cn("w-5 h-5", color)} />
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-8",
          isDragActive
            ? "border-brand-500 bg-brand-50"
            : "border-gray-300 hover:border-brand-400 hover:bg-gray-50",
          uploadMutation.isPending && "opacity-60 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
            <p className="text-gray-600 font-medium">Procesando orden de compra...</p>
            <p className="text-gray-400 text-sm">Esto puede tardar unos segundos</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-brand-600" />
            </div>
            <div>
              <p className="text-gray-700 font-semibold text-lg">
                {isDragActive ? "Suelta el archivo aquí" : "Subir orden de compra"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Arrastrá o hacé click — PDF, XLSX, XLS, CSV (máx. 50MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Órdenes recientes</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Todavía no hay órdenes procesadas
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.slice(0, 10).map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onClick={() => router.push(`/review/${order.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order, onClick }: { order: OrderSummary; onClick: () => void }) {
  const badge = statusBadge(order.status);
  return (
    <button
      onClick={onClick}
      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex items-center gap-4">
        <FileText className="w-5 h-5 text-gray-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">{order.original_filename}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(order.created_at)} · {order.line_count} líneas · {order.distributor}
          </p>
        </div>
      </div>
      <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", badge.className)}>
        {badge.label}
      </span>
    </button>
  );
}
