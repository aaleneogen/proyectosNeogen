"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  Download, ArrowLeft, CheckCircle2, AlertTriangle, XCircle,
  Edit2, Check, X, Info, Truck, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { ordersApi, deliveriesApi, OrderLine } from "@/lib/api";
import { cn, confidenceBadge, lineStatusBadge, orderStatusBadge, formatCurrency, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { AppShell } from "@/components/layout/AppShell";

export default function ReviewPage() {
  return <AppShell><ReviewContent /></AppShell>;
}

function ReviewContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();

  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<OrderLine>>({});
  const [deliveryLine, setDeliveryLine] = useState<string | null>(null);
  const [deliveryQty, setDeliveryQty] = useState<string>("");
  const [deliveryNotes, setDeliveryNotes] = useState<string>("");
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => ordersApi.get(id),
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: Partial<OrderLine> }) =>
      ordersApi.updateLine(id, lineId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["order", id] }); setEditingLine(null); toast.success("Línea actualizada"); },
  });

  const deliveryMutation = useMutation({
    mutationFn: ({ lineId, qty, notes }: { lineId: string; qty: number; notes: string }) =>
      deliveriesApi.register(lineId, qty, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      setDeliveryLine(null);
      setDeliveryQty("");
      setDeliveryNotes("");
      toast.success("Entrega registrada");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al registrar entrega"),
  });

  const approveMutation = useMutation({
    mutationFn: () => ordersApi.approve(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["order", id] }); toast.success("Pedido aprobado"); },
  });

  const exportMutation = useMutation({
    mutationFn: () => ordersApi.export(id, order?.order_number),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); toast.success("Excel SAP descargado"); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al exportar"),
  });

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400">Cargando...</div>;
  if (!order) return null;

  const lines = order.lines || [];
  const validCount = lines.filter((l) => l.is_valid).length;
  const statusBadge = orderStatusBadge(order.status);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-gray-900">{order.order_number || order.id.slice(0, 8)}</h1>
                <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", statusBadge.className)}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{order.original_filename} · {lines.length} líneas · {validCount} válidas</p>
            </div>
          </div>

          {isAdmin() && (
            <div className="flex gap-2">
              {order.status === "review" && (
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
                >
                  Aprobar pedido
                </button>
              )}
              <button
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || validCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                {exportMutation.isPending ? "Exportando..." : `Exportar SAP (${validCount})`}
              </button>
            </div>
          )}
        </div>

        {/* Status summary */}
        <div className="flex gap-3 mt-4">
          {[
            { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", count: lines.filter(l => l.confidence === "high").length, label: "Confianza alta" },
            { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", count: lines.filter(l => l.confidence === "medium").length, label: "Revisar" },
            { icon: XCircle, color: "text-red-600", bg: "bg-red-50", count: lines.filter(l => l.confidence === "none").length, label: "Sin match" },
          ].map(({ icon: Icon, color, bg, count, label }) => (
            <div key={label} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", bg)}>
              <Icon className={cn("w-4 h-4", color)} />
              <span className={cn("text-sm font-medium", color)}>{count} {label}</span>
            </div>
          ))}
        </div>

        {order.parse_errors.length > 0 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-medium mb-1">
              <Info className="w-3.5 h-3.5" /> Avisos del parseo
            </div>
            {order.parse_errors.map((e, i) => <p key={i} className="text-amber-600 text-xs">{e}</p>)}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-6">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descripción original</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pedido</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entregado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, idx) => (
                <>
                  <LineRow
                    key={line.id}
                    line={line}
                    idx={idx + 1}
                    isEditing={editingLine === line.id}
                    editValues={editValues}
                    isDelivering={deliveryLine === line.id}
                    deliveryQty={deliveryQty}
                    deliveryNotes={deliveryNotes}
                    isExpanded={expandedLine === line.id}
                    isAdmin={isAdmin()}
                    onEdit={() => { setEditingLine(line.id); setEditValues({ matched_sku: line.matched_sku || "", matched_description: line.matched_description || "", quantity_ordered: line.quantity_ordered, unit_price: line.unit_price ?? undefined }); }}
                    onSave={() => updateLineMutation.mutate({ lineId: line.id, data: editValues })}
                    onCancel={() => setEditingLine(null)}
                    onEditChange={(f, v) => setEditValues((p) => ({ ...p, [f]: v }))}
                    onDelivery={() => { setDeliveryLine(line.id); setDeliveryQty(String(line.quantity_pending)); }}
                    onDeliverySubmit={() => deliveryMutation.mutate({ lineId: line.id, qty: parseFloat(deliveryQty), notes: deliveryNotes })}
                    onDeliveryCancel={() => { setDeliveryLine(null); setDeliveryQty(""); setDeliveryNotes(""); }}
                    onDeliveryQtyChange={setDeliveryQty}
                    onDeliveryNotesChange={setDeliveryNotes}
                    onToggleExpand={() => setExpandedLine(expandedLine === line.id ? null : line.id)}
                    isSaving={updateLineMutation.isPending}
                    isDeliverySaving={deliveryMutation.isPending}
                  />
                  {expandedLine === line.id && line.deliveries.length > 0 && (
                    <tr key={`${line.id}-deliveries`}>
                      <td colSpan={10} className="px-4 pb-3 pt-0 bg-gray-50">
                        <div className="ml-6 border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="text-left px-3 py-2 text-gray-500">Fecha</th>
                                <th className="text-center px-3 py-2 text-gray-500">Cantidad</th>
                                <th className="text-left px-3 py-2 text-gray-500">Notas</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {line.deliveries.map((d) => (
                                <tr key={d.id} className="bg-white">
                                  <td className="px-3 py-2 text-gray-600">{formatDate(d.delivery_date)}</td>
                                  <td className="px-3 py-2 text-center font-medium text-emerald-700">{d.quantity_delivered}</td>
                                  <td className="px-3 py-2 text-gray-500">{d.notes || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LineRow({ line, idx, isEditing, editValues, isDelivering, deliveryQty, deliveryNotes,
  isExpanded, isAdmin, onEdit, onSave, onCancel, onEditChange, onDelivery, onDeliverySubmit,
  onDeliveryCancel, onDeliveryQtyChange, onDeliveryNotesChange, onToggleExpand, isSaving, isDeliverySaving }: any) {

  const confidence = confidenceBadge(line.confidence);
  const status = lineStatusBadge(line.line_status);

  const borderColor = {
    high: "border-l-emerald-400", medium: "border-l-amber-400",
    low: "border-l-orange-400", none: "border-l-red-400",
  }[line.confidence as string] || "";

  if (isDelivering) {
    return (
      <tr className="bg-blue-50/40">
        <td className="px-4 py-3 text-gray-400 text-xs">{idx}</td>
        <td colSpan={6} className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Truck className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">{line.matched_description || line.raw_description}</p>
              <p className="text-xs text-gray-500">Pendiente: {line.quantity_pending} unidades</p>
            </div>
          </div>
        </td>
        <td colSpan={3} className="px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="number" min="0.01" step="0.01" max={line.quantity_pending}
                className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                value={deliveryQty}
                onChange={(e) => onDeliveryQtyChange(e.target.value)}
                placeholder="Cantidad"
              />
              <input
                type="text"
                className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                value={deliveryNotes}
                onChange={(e) => onDeliveryNotesChange(e.target.value)}
                placeholder="Notas (opcional)"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={onDeliverySubmit} disabled={!deliveryQty || isDeliverySaving}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                {isDeliverySaving ? "Registrando..." : "Registrar entrega"}
              </button>
              <button onClick={onDeliveryCancel} className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={cn("transition-colors hover:bg-gray-50/70 border-l-2", borderColor)}>
      <td className="px-4 py-3 text-gray-400 text-xs">{idx}</td>
      <td className="px-4 py-3">
        <p className="text-gray-700 max-w-[180px] truncate text-xs" title={line.raw_description}>{line.raw_description}</p>
        {line.warnings.length > 0 && <p className="text-xs text-amber-500 mt-0.5">{line.warnings[0]}</p>}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input className="border border-gray-300 rounded px-2 py-1 text-xs w-28 font-mono"
            value={editValues.matched_sku || ""} onChange={(e) => onEditChange("matched_sku", e.target.value)} />
        ) : (
          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{line.matched_sku || "—"}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input className="border border-gray-300 rounded px-2 py-1 text-xs w-40"
            value={editValues.matched_description || ""} onChange={(e) => onEditChange("matched_description", e.target.value)} />
        ) : (
          <span className="text-gray-700 text-xs max-w-[160px] truncate block" title={line.matched_description || ""}>{line.matched_description || "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center font-medium">
        {isEditing ? (
          <input type="number" className="border border-gray-300 rounded px-2 py-1 text-xs w-16 text-center"
            value={editValues.quantity_ordered ?? ""} onChange={(e) => onEditChange("quantity_ordered", parseFloat(e.target.value))} />
        ) : line.quantity_ordered || "—"}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-emerald-700 font-medium">{line.quantity_delivered}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={cn("font-medium", line.quantity_pending > 0 ? "text-amber-600" : "text-gray-400")}>
          {line.quantity_pending}
        </span>
      </td>
      <td className="px-4 py-3 text-center text-xs">
        {isEditing ? (
          <input type="number" step="0.01" className="border border-gray-300 rounded px-2 py-1 text-xs w-20 text-center"
            value={editValues.unit_price ?? ""} onChange={(e) => onEditChange("unit_price", parseFloat(e.target.value))} />
        ) : (
          line.unit_price != null ? formatCurrency(line.unit_price) : "—"
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status.className)}>
            {status.icon} {status.label}
          </span>
          <span className={cn("text-xs px-1.5 py-0.5 rounded border text-[10px]", confidence.className)}>
            {confidence.label} {line.confidence_score}%
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {isEditing ? (
            <>
              <button onClick={onSave} disabled={isSaving} className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={onCancel} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <>
              {isAdmin && <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>}
              {isAdmin && line.quantity_pending > 0 && (
                <button onClick={onDelivery} className="p-1.5 hover:bg-blue-100 rounded text-gray-400 hover:text-blue-600" title="Registrar entrega"><Truck className="w-3.5 h-3.5" /></button>
              )}
              {line.deliveries?.length > 0 && (
                <button onClick={onToggleExpand} className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
