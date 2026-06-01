"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  Download, ArrowLeft, CheckCircle2, AlertTriangle, XCircle,
  Edit2, Check, X, Info
} from "lucide-react";
import { toast } from "sonner";
import { ordersApi, OrderLine } from "@/lib/api";
import { cn, confidenceBadge, formatCurrency } from "@/lib/utils";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<OrderLine>>({});

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => ordersApi.get(id),
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: Partial<OrderLine> }) =>
      ordersApi.updateLine(id, lineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      setEditingLine(null);
      toast.success("Línea actualizada");
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => ordersApi.export(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Excel exportado correctamente");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al exportar"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Cargando orden...</div>
      </div>
    );
  }

  if (!order) return null;

  const lines = order.lines || [];
  const validCount = lines.filter((l) => l.is_valid).length;
  const highCount = lines.filter((l) => l.confidence === "high").length;
  const reviewCount = lines.filter((l) => l.confidence === "medium" || l.confidence === "low").length;
  const noneCount = lines.filter((l) => l.confidence === "none").length;

  const startEdit = (line: OrderLine) => {
    setEditingLine(line.id);
    setEditValues({
      matched_sku: line.matched_sku || "",
      matched_description: line.matched_description || "",
      quantity: line.quantity ?? undefined,
      unit_price: line.unit_price ?? undefined,
    });
  };

  const saveEdit = (lineId: string) => {
    updateLineMutation.mutate({ lineId, data: editValues });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{order.original_filename}</h1>
              <p className="text-sm text-gray-500">
                {lines.length} líneas detectadas · {validCount} válidas para exportar
              </p>
            </div>
          </div>

          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || validCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {exportMutation.isPending ? "Exportando..." : `Exportar Excel SAP (${validCount})`}
          </button>
        </div>

        {/* Summary badges */}
        <div className="flex gap-4 mt-4">
          <SummaryBadge icon={CheckCircle2} color="text-green-600" bg="bg-green-50" count={highCount} label="Confianza alta" />
          <SummaryBadge icon={AlertTriangle} color="text-yellow-600" bg="bg-yellow-50" count={reviewCount} label="Revisar" />
          <SummaryBadge icon={XCircle} color="text-red-600" bg="bg-red-50" count={noneCount} label="Sin match" />
        </div>
      </div>

      {/* Errors */}
      {order.parse_errors.length > 0 && (
        <div className="mx-8 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
            <Info className="w-4 h-4" /> Avisos del parseo
          </div>
          {order.parse_errors.map((e, i) => (
            <p key={i} className="text-amber-600 text-xs">{e}</p>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción original</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción match</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cantidad</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Confianza</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, idx) => (
                <LineRow
                  key={line.id}
                  line={line}
                  idx={idx + 1}
                  isEditing={editingLine === line.id}
                  editValues={editValues}
                  onEdit={() => startEdit(line)}
                  onSave={() => saveEdit(line.id)}
                  onCancel={() => setEditingLine(null)}
                  onEditChange={(field, value) => setEditValues((prev) => ({ ...prev, [field]: value }))}
                  isSaving={updateLineMutation.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryBadge({ icon: Icon, color, bg, count, label }: any) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", bg)}>
      <Icon className={cn("w-4 h-4", color)} />
      <span className={cn("text-sm font-medium", color)}>{count} {label}</span>
    </div>
  );
}

function LineRow({ line, idx, isEditing, editValues, onEdit, onSave, onCancel, onEditChange, isSaving }: {
  line: OrderLine;
  idx: number;
  isEditing: boolean;
  editValues: Partial<OrderLine>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditChange: (field: string, value: any) => void;
  isSaving: boolean;
}) {
  const badge = confidenceBadge(line.confidence);

  const rowBg = {
    high: "hover:bg-green-50/50",
    medium: "hover:bg-yellow-50/50",
    low: "hover:bg-orange-50/50",
    none: "bg-red-50/30 hover:bg-red-50/50",
  }[line.confidence] || "";

  const borderLeft = {
    high: "border-l-2 border-l-green-400",
    medium: "border-l-2 border-l-yellow-400",
    low: "border-l-2 border-l-orange-400",
    none: "border-l-2 border-l-red-400",
  }[line.confidence] || "";

  return (
    <tr className={cn("transition-colors", rowBg, borderLeft)}>
      <td className="px-4 py-3 text-gray-400 text-xs">{idx}</td>

      <td className="px-4 py-3">
        <p className="text-gray-700 max-w-[200px] truncate" title={line.raw_description}>
          {line.raw_description}
        </p>
        {line.warnings.length > 0 && (
          <div className="mt-1">
            {line.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600">{w}</p>
            ))}
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        {isEditing ? (
          <input
            className="border border-gray-300 rounded px-2 py-1 text-sm w-32 font-mono"
            value={editValues.matched_sku || ""}
            onChange={(e) => onEditChange("matched_sku", e.target.value)}
          />
        ) : (
          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
            {line.matched_sku || "—"}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        {isEditing ? (
          <input
            className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
            value={editValues.matched_description || ""}
            onChange={(e) => onEditChange("matched_description", e.target.value)}
          />
        ) : (
          <span className="text-gray-700 max-w-[200px] truncate block" title={line.matched_description || ""}>
            {line.matched_description || "—"}
          </span>
        )}
      </td>

      <td className="px-4 py-3 text-center">
        {isEditing ? (
          <input
            type="number"
            className="border border-gray-300 rounded px-2 py-1 text-sm w-20 text-center"
            value={editValues.quantity ?? ""}
            onChange={(e) => onEditChange("quantity", parseFloat(e.target.value))}
          />
        ) : (
          <span className="font-medium">{line.quantity ?? "—"}</span>
        )}
      </td>

      <td className="px-4 py-3 text-center">
        {isEditing ? (
          <input
            type="number"
            step="0.01"
            className="border border-gray-300 rounded px-2 py-1 text-sm w-24 text-center"
            value={editValues.unit_price ?? ""}
            onChange={(e) => onEditChange("unit_price", parseFloat(e.target.value))}
          />
        ) : (
          <span>{line.unit_price != null ? formatCurrency(line.unit_price) : "—"}</span>
        )}
      </td>

      <td className="px-4 py-3 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", badge.className)}>
            {badge.label}
          </span>
          <span className="text-xs text-gray-400">{line.confidence_score}%</span>
        </div>
      </td>

      <td className="px-4 py-3 text-center">
        {isEditing ? (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={onSave}
              disabled={isSaving}
              className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
